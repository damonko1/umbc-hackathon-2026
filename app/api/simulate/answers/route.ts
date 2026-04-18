import { z } from "zod";
import { resumeSimulation } from "@/lib/orchestrator";
import { ClarifyingAnswerSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  simulationId: z.string().min(1),
  answers: z.array(ClarifyingAnswerSchema).min(1).max(3),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { simulationId, answers } = parsed.data;

  try {
    const result = await resumeSimulation(simulationId, answers);
    return Response.json({
      status: "complete",
      simulationId,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[api/simulate/answers] failed (sim=${simulationId.slice(0, 8)}): ${message}`,
    );
    const status = /Unknown simulation|not awaiting answers|no stored input|No matching answers/i.test(message)
      ? 400
      : 500;
    return Response.json({ error: message, simulationId }, { status });
  }
}
