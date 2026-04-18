import fs from "node:fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const model = process.argv[2] ?? "gpt-oss:120b";
console.log("model:", model);

const schema = {
  type: "object",
  properties: {
    rationale: { type: "string" },
    timeUnit: { type: "string", enum: ["hour", "day", "week", "month", "year"] },
    numSteps: { type: "integer", minimum: 3, maximum: 36 },
    forks: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "label", "description"],
      },
    },
  },
  required: ["rationale", "timeUnit", "numSteps", "forks"],
};

const start = Date.now();
const res = await fetch("https://ollama.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          'You are a planner. Output a simulation plan as strict JSON. Include "rationale", "timeUnit", "numSteps", "forks".',
      },
      {
        role: "user",
        content:
          'Decision: "Should I tell my friend their comment hurt me?". Options: ["Have the honest conversation", "Let it slide"]. Return JSON.',
      },
    ],
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: { name: "PlannerOutput", strict: true, schema },
    },
  }),
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`status: ${res.status} in ${elapsed}s`);
const text = await res.text();
console.log("body:", text.slice(0, 2000));
