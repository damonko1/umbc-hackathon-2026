import { z } from "zod";
import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getDecisionDetail, setChosenFork } from "@/lib/history";

export const runtime = "nodejs";

const UpdateChosenForkSchema = z.object({
  chosenForkId: z.string().min(1).nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isHistoryPersistenceEnabled()) {
    return Response.json(
      { error: "History persistence is not configured" },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const detail = await getDecisionDetail({
    deviceId: device.id,
    decisionRunId: id,
  });

  if (!detail) {
    return Response.json({ error: "Decision not found" }, { status: 404 });
  }

  return Response.json(detail);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isHistoryPersistenceEnabled()) {
    return Response.json(
      { error: "History persistence is not configured" },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateChosenForkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const result = await setChosenFork({
    deviceId: device.id,
    decisionRunId: id,
    chosenForkId: parsed.data.chosenForkId,
  });

  if (result.kind === "not_found") {
    return Response.json({ error: "Decision not found" }, { status: 404 });
  }

  if (result.kind === "invalid_choice") {
    return Response.json({ error: "Invalid chosenForkId" }, { status: 400 });
  }

  return Response.json({ chosenForkId: result.chosenForkId });
}
