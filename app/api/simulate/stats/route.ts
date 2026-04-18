import { telemetry } from "@/lib/llm/telemetry";
import { getRateLimitedProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const rateLimited = getRateLimitedProvider();
  const queueDepth = rateLimited?.getQueueDepth() ?? 0;
  const rpm = rateLimited?.getRpm() ?? null;

  if (id) {
    const sim = telemetry.getSim(id);
    if (!sim) {
      return Response.json(
        { simulationId: id, found: false, queueDepth, rpm },
        { status: 200 },
      );
    }
    const elapsedMs = (sim.endedAt ?? Date.now()) - sim.startedAt;
    return Response.json({
      simulationId: sim.id,
      found: true,
      stage: sim.stage,
      callsDone: sim.callsDone,
      callsExpected: sim.callsExpected,
      plannedForks: sim.plannedForks,
      plannedDimensions: sim.plannedDimensions,
      perAgent: sim.perAgent,
      maxInFlight: sim.maxInFlight,
      rate429: sim.rate429,
      errors: sim.errors,
      elapsedMs,
      ended: sim.endedAt !== null,
      queueDepth,
      rpm,
    });
  }

  return Response.json({
    ...telemetry.globalSnapshot(),
    queueDepth,
    rpm,
  });
}
