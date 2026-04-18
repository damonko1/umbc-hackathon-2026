import type { LlmProvider } from "./types";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import { MiniMaxProvider } from "./minimax";
import { RateLimitedProvider } from "./rate-limiter";

export type { LlmProvider, ChatMessage, StructuredRequest } from "./types";
export { OllamaProvider, GeminiProvider, MiniMaxProvider, RateLimitedProvider };

let cached: LlmProvider | null = null;

function defaultRpmFor(providerName: string): number {
  if (providerName === "gemini") return 5;
  if (providerName === "minimax") return 60;
  if (providerName === "ollama") return 60;
  return 30;
}

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;

  const providerName = (process.env.LLM_PROVIDER ?? "minimax").toLowerCase();
  let base: LlmProvider;

  if (providerName === "ollama") {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OLLAMA_API_KEY is not set. Get a free key at https://ollama.com/settings/keys",
      );
    }
    base = new OllamaProvider({
      apiKey,
      host: process.env.OLLAMA_HOST,
      model: process.env.LLM_MODEL,
    });
  } else if (providerName === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey",
      );
    }
    base = new GeminiProvider({
      apiKey,
      model: process.env.LLM_MODEL,
    });
  } else {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error(
        "MINIMAX_API_KEY is not set. Get a key at https://platform.minimax.io",
      );
    }
    base = new MiniMaxProvider({
      apiKey,
      model: process.env.LLM_MODEL,
      baseURL: process.env.MINIMAX_BASE_URL,
    });
  }

  const rpmRaw = process.env.LLM_RPM;
  const rpm = rpmRaw ? parseInt(rpmRaw, 10) : defaultRpmFor(providerName);
  cached = new RateLimitedProvider(base, {
    rpm: Number.isFinite(rpm) ? rpm : defaultRpmFor(providerName),
  });
  return cached;
}
