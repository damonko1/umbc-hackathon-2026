import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { parseUpdateMemoryItem, updateMemoryItem } from "@/lib/memory";

export const runtime = "nodejs";

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

  const parsed = parseUpdateMemoryItem(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());
  const result = await updateMemoryItem({
    deviceId: device.id,
    memoryItemId: id,
    patch: parsed.data,
  });

  if (result.kind === "not_found") {
    return Response.json({ error: "Memory item not found" }, { status: 404 });
  }

  return Response.json(result.item);
}
