import { GoogleGenAI, Type } from "@google/genai";
import { z, type ZodTypeAny } from "zod";
import type { LlmProvider, StructuredRequest } from "./types";

type JsonSchema = Record<string, unknown>;

function toGeminiSchema(node: JsonSchema): JsonSchema {
  if (!node || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema" || k === "$ref" || k === "definitions") continue;
    if (k === "type" && typeof v === "string") {
      out.type = (
        {
          string: Type.STRING,
          number: Type.NUMBER,
          integer: Type.INTEGER,
          boolean: Type.BOOLEAN,
          array: Type.ARRAY,
          object: Type.OBJECT,
        } as Record<string, unknown>
      )[v];
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === "object" && item ? toGeminiSchema(item as JsonSchema) : item,
      );
    } else if (typeof v === "object" && v) {
      out[k] = toGeminiSchema(v as JsonSchema);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export class GeminiProvider implements LlmProvider {
  name = "gemini";
  model: string;
  private client: GoogleGenAI;

  constructor(opts: { apiKey: string; model?: string }) {
    this.model = opts.model ?? "gemini-2.5-flash-lite";
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  async generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    const rawSchema = z.toJSONSchema(req.schema, { target: "draft-7" }) as JsonSchema;
    const geminiSchema = toGeminiSchema(rawSchema);
    const maxRetries = req.maxRetries ?? 1;

    const systemInstruction = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: systemInstruction || undefined,
            temperature: req.temperature ?? 0.7,
            responseMimeType: "application/json",
            responseSchema: geminiSchema as never,
          },
        });
        const raw = response.text ?? "";
        const parsed = JSON.parse(raw);
        const u = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
          .usageMetadata;
        req.onMeta?.({
          usage: u
            ? { inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount }
            : undefined,
          retries: attempt,
        });
        return req.schema.parse(parsed) as z.infer<S>;
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) {
          req.onMeta?.({ retries: attempt });
          break;
        }
      }
    }
    throw new Error(
      `GeminiProvider.generateStructured failed after ${maxRetries + 1} attempts: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }
}
