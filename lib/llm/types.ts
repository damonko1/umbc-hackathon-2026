import type { ZodTypeAny, z } from "zod";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredRequest<S extends ZodTypeAny> = {
  messages: ChatMessage[];
  schema: S;
  schemaName: string;
  temperature?: number;
  maxRetries?: number;
};

export interface LlmProvider {
  name: string;
  model: string;
  generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>>;
}
