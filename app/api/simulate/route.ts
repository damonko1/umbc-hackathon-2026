import { randomUUID } from "node:crypto";
import { runSimulation } from "@/lib/orchestrator";
import { DecisionInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const rawSimulationId =
    body && typeof body === "object" && "simulationId" in body
      ? (body as { simulationId?: unknown }).simulationId
      : undefined;
  const simulationId =
    typeof rawSimulationId === "string" && rawSimulationId.length > 0
      ? rawSimulationId
      : randomUUID();

  const parsed = DecisionInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid input",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await runSimulation(parsed.data, { simulationId });
    return Response.json({ ...result, simulationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api/simulate] failed (sim=${simulationId.slice(0, 8)}): ${message}`);
    return Response.json({ error: message, simulationId }, { status: 500 });
  }
}
