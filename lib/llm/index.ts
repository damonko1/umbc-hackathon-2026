import type { LlmProvider } from "./types";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";

export type { LlmProvider, ChatMessage, StructuredRequest } from "./types";
export { OllamaProvider, GeminiProvider };

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;

  const providerName = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();

  if (providerName === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    cached = new GeminiProvider({
      apiKey,
      model: process.env.LLM_MODEL,
    });
    return cached;
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OLLAMA_API_KEY is not set. Get a free key at https://ollama.com/settings/keys",
    );
  }
  cached = new OllamaProvider({
    apiKey,
    host: process.env.OLLAMA_HOST,
    model: process.env.LLM_MODEL,
  });
  return cached;
}
