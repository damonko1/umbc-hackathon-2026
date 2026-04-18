import { Ollama } from "ollama";
import { z, type ZodTypeAny } from "zod";
import type { LlmProvider, StructuredRequest } from "./types";

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  if (start > 0) {
    const lastClose = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (lastClose > start) return trimmed.slice(start, lastClose + 1);
  }
  return trimmed;
}

export class OllamaProvider implements LlmProvider {
  name = "ollama";
  model: string;
  private client: Ollama;

  constructor(opts: { apiKey: string; host?: string; model?: string }) {
    this.model = opts.model ?? "qwen3.5:397b";
    this.client = new Ollama({
      host: opts.host ?? "https://ollama.com",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
    });
  }

  async generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-7" });
    const maxRetries = req.maxRetries ?? 1;

    // Embed the schema in the final user message as a defensive layer —
    // some Ollama Cloud models don't strictly enforce the `format` param.
    const schemaInstruction = `\n\nYou MUST return a single JSON object matching EXACTLY this JSON schema. Do not invent extra top-level fields. Every "required" field is mandatory. No markdown code fences.\n\nSCHEMA:\n${JSON.stringify(jsonSchema)}`;

    const messages = req.messages.map((m, idx) =>
      idx === req.messages.length - 1
        ? { ...m, content: m.content + schemaInstruction }
        : m,
    );

    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat({
          model: this.model,
          messages,
          format: jsonSchema as Record<string, unknown>,
          options: { temperature: req.temperature ?? 0.7 },
          stream: false,
        });

        const raw = response.message?.content ?? "";
        const clean = extractJson(raw);
        const parsed = JSON.parse(clean);
        return req.schema.parse(parsed) as z.infer<S>;
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) break;
      }
    }
    throw new Error(
      `OllamaProvider.generateStructured failed after ${maxRetries + 1} attempts: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }
}
