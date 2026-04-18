import { Ollama } from "ollama";
import fs from "node:fs";

// Load .env.local
const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const client = new Ollama({
  host: "https://ollama.com",
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
});

const model = process.argv[2] ?? "qwen3-coder:480b-cloud";
console.log(`Testing model: ${model}`);

const start = Date.now();
try {
  const res = await client.chat({
    model,
    messages: [
      { role: "user", content: 'Return JSON: {"ok": true, "message": "hello"}' },
    ],
    format: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        message: { type: "string" },
      },
      required: ["ok", "message"],
    },
    options: { temperature: 0 },
    stream: false,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`OK in ${elapsed}s`);
  console.log("content:", res.message?.content);
} catch (err) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`FAIL in ${elapsed}s:`, err.message);
}
