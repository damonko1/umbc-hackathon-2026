import { randomUUID } from "node:crypto";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import {
  createPendingDecisionRun,
  finalizeDecisionRun,
  markDecisionRunFailed,
} from "@/lib/history";
import { runSimulation } from "@/lib/orchestrator";
import { DecisionInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
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
      { status: 400 }
    );
  }

  if (!isHistoryPersistenceEnabled()) {
    try {
      const startResult = await runSimulation(parsed.data, { simulationId });
      if (startResult.status === "questions") {
        return Response.json({
          status: "questions",
          simulationId: startResult.simulationId,
          questions: startResult.questions,
        });
      }

      return Response.json({
        status: "complete",
        simulationId: startResult.simulationId,
        result: startResult.result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[api/simulate] failed (sim=${simulationId.slice(0, 8)}): ${message}`);
      return Response.json({ error: message, simulationId }, { status: 500 });
    }
  }

  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const pendingRun = await createPendingDecisionRun({
    deviceId: device.id,
    input: parsed.data,
  });

  try {
    const startResult = await runSimulation(parsed.data, { simulationId });

    if (startResult.status === "questions") {
      return Response.json({
        status: "questions",
        simulationId: startResult.simulationId,
        questions: startResult.questions,
        decisionRunId: pendingRun.id,
      });
    }

    await finalizeDecisionRun({
      decisionRunId: pendingRun.id,
      deviceId: device.id,
      input: parsed.data,
      result: startResult.result,
    });

    return Response.json({
      status: "complete",
      simulationId: startResult.simulationId,
      result: startResult.result,
      decisionRunId: pendingRun.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markDecisionRunFailed({
      decisionRunId: pendingRun.id,
      errorMessage: message,
    });
    console.error(`[api/simulate] failed (sim=${simulationId.slice(0, 8)}): ${message}`);
    return Response.json(
      { error: message, simulationId, decisionRunId: pendingRun.id },
      { status: 500 }
    );
  }
}
