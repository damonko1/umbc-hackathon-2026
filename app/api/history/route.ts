import { getDeviceTokenFromCookies, resolveOrCreateDevice } from "@/lib/device";
import { isHistoryPersistenceEnabled } from "@/lib/db";
import { getHistoryPageSize, listDecisionHistory } from "@/lib/history";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isHistoryPersistenceEnabled()) {
    return Response.json(
      { error: "History persistence is not configured" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const device = await resolveOrCreateDevice(await getDeviceTokenFromCookies());

  const data = await listDecisionHistory({
    deviceId: device.id,
    limit: getHistoryPageSize(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor"),
  });

  return Response.json(data);
}
