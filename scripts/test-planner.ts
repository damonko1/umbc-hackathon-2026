import fs from "node:fs";
import path from "node:path";

async function main() {
  const envText = fs.readFileSync(path.resolve(".env.local"), "utf-8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }

  const { z } = await import("zod");
  const { PlannerOutputSchema } = await import("../lib/schemas.ts");
  const { Ollama } = await import("ollama");

  const jsonSchema = z.toJSONSchema(PlannerOutputSchema, { target: "draft-7" });
  console.log("JSON SCHEMA:\n", JSON.stringify(jsonSchema, null, 2));

  const client = new Ollama({
    host: "https://ollama.com",
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  });

  const model = process.argv[2] ?? "qwen3-coder:480b-cloud";
  console.log(`\n--- Calling ${model} ---\n`);
  const res = await client.chat({
    model,
    messages: [
      {
        role: "system",
        content:
          'You are a planner. Always output strict JSON matching the schema. Every required field MUST be present including "rationale". Return ONLY JSON.',
      },
      {
        role: "user",
        content:
          'Plan a simulation for: question "Should I tell my friend their comment hurt?", options ["Have the honest conversation", "Let it slide"]. Return ONLY JSON.',
      },
    ],
    format: jsonSchema,
    options: { temperature: 0.3 },
    stream: false,
  });

  console.log("RAW CONTENT:");
  console.log(res.message?.content);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
