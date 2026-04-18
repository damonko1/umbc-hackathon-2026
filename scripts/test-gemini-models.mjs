import fs from "node:fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const { GoogleGenAI } = await import("@google/genai");
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.0-flash-lite",
];

for (const model of models) {
  const start = Date.now();
  try {
    const res = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: 'Return JSON: {"ok": true}' }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`OK ${model} in ${elapsed}s → ${(res.text ?? "").slice(0, 80)}`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const msg = err instanceof Error ? err.message : String(err);
    const short = msg.includes("429") ? "QUOTA=0" : msg.slice(0, 100);
    console.log(`FAIL ${model} in ${elapsed}s → ${short}`);
  }
}
