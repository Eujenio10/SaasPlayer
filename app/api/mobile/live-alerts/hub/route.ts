import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";
import { fetchLiveFootballMatches, fetchMatchDetails, isMonitoredLiveMatch } from "@/lib/live-alerts/footapi-service";
import { isTrackedLiveFixture, recountAndSyncActiveMatch, touchViewer } from "@/lib/live-alerts/persist";

export const dynamic = "force-dynamic";

const heartbeatSchema = z.object({
  fixtureId: z.number().int().positive()
});

export async function GET() {
  const matches = await fetchLiveFootballMatches();
  return NextResponse.json({ matches }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const fixtureId = parsed.data.fixtureId;
  const tracked = await isTrackedLiveFixture(fixtureId);
  if (!tracked) {
    const details = await fetchMatchDetails(fixtureId);
    if (!details || !isMonitoredLiveMatch(details)) {
      return NextResponse.json({ error: "competition_not_allowed" }, { status: 403, headers: NO_STORE_HEADERS });
    }
  }
  await touchViewer(user.id, fixtureId);
  await recountAndSyncActiveMatch(fixtureId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
