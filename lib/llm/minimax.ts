import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodTypeAny } from "zod";
import type { LlmProvider, StructuredRequest } from "./types";

type JsonSchema = Record<string, unknown>;

/**
 * Strip meta keys the Anthropic tool-input schema validator rejects or ignores.
 */
function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (!node || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(node as JsonSchema)) {
    if (k === "$schema" || k === "$id" || k === "$ref" || k === "definitions") continue;
    out[k] = cleanSchema(v);
  }
  return out;
}

/**
 * MiniMax exposes an Anthropic-compatible endpoint at
 * https://api.minimax.io/anthropic. Structured output isn't native, so we use
 * forced tool use: the Zod schema becomes a single tool's input_schema, the
 * model is required to call it, and we return the tool input as the result.
 */
export class MiniMaxProvider implements LlmProvider {
  name = "minimax";
  model: string;
  private client: Anthropic;

  constructor(opts: { apiKey: string; model?: string; baseURL?: string }) {
    this.model = opts.model ?? "MiniMax-M2.7-highspeed";
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? "https://api.minimax.io/anthropic",
    });
  }

  async generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    const rawSchema = z.toJSONSchema(req.schema, { target: "draft-7" }) as JsonSchema;
    const inputSchema = cleanSchema(rawSchema) as JsonSchema;

    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "return_result";

    const systemText = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    const maxRetries = req.maxRetries ?? 1;
    let lastErr: unknown;
    let lastUsage: { inputTokens?: number; outputTokens?: number } | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 8192,
          temperature: req.temperature ?? 0.7,
          system: systemText || undefined,
          messages,
          tools: [
            {
              name: toolName,
              description: `Return the final structured result as ${req.schemaName}. Call this exactly once.`,
              input_schema: inputSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: toolName },
        });

        if (response.usage) {
          lastUsage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          };
        }

        const toolBlock = response.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );
        if (!toolBlock) {
          throw new Error(
            `MiniMaxProvider: no tool_use block in response; stop_reason=${response.stop_reason}`,
          );
        }

        req.onMeta?.({ usage: lastUsage, retries: attempt });
        return req.schema.parse(toolBlock.input) as z.infer<S>;
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) {
          req.onMeta?.({ usage: lastUsage, retries: attempt });
          break;
        }
      }
    }
    throw new Error(
      `MiniMaxProvider.generateStructured failed after ${maxRetries + 1} attempts: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }
}
