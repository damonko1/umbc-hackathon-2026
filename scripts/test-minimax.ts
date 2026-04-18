import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

async function main() {
  const envText = fs.readFileSync(path.resolve(".env.local"), "utf-8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }

  const { MiniMaxProvider } = await import("../lib/llm/minimax.ts");
  const provider = new MiniMaxProvider({
    apiKey: process.env.MINIMAX_API_KEY!,
  });

  const schema = z.object({
    greeting: z.string(),
    n: z.number().int(),
  });

  console.log(`model=${provider.model}`);
  const start = Date.now();
  const result = await provider.generateStructured({
    messages: [
      { role: "system", content: "You return structured JSON." },
      { role: "user", content: 'Return {"greeting": "hello", "n": 42}.' },
    ],
    schema,
    schemaName: "Probe",
    temperature: 0.2,
  });
  console.log(`ok in ${((Date.now() - start) / 1000).toFixed(1)}s →`, result);
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
