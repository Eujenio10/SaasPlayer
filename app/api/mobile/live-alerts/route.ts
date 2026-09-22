import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";
import { fetchMatchDetails, isMonitoredLiveMatch } from "@/lib/live-alerts/footapi-service";
import { insertAlert, isTrackedLiveFixture, listUserAlerts, recountAndSyncActiveMatch } from "@/lib/live-alerts/persist";
import { clampTarget } from "@/lib/live-alerts/thresholds";
import { isAllowedStatistic } from "@/lib/live-alerts/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  fixtureId: z.number().int().positive(),
  alertType: z.enum(["team", "player"]),
  statisticName: z.string(),
  targetValue: z.number(),
  teamId: z.number().int().positive().optional().nullable(),
  playerId: z.number().int().positive().optional().nullable(),
  subjectName: z.string().optional().nullable(),
  locale: z.enum(["it", "en"]).optional()
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const url = new URL(request.url);
  const fixtureId = Number(url.searchParams.get("fixtureId") ?? "");
  const alerts = await listUserAlerts(user.id, Number.isFinite(fixtureId) && fixtureId > 0 ? fixtureId : undefined);
  return NextResponse.json({ alerts }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const body = parsed.data;
  if (!isAllowedStatistic(body.alertType, body.statisticName)) {
    return NextResponse.json({ error: "invalid_statistic" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (body.alertType === "team" && !body.teamId) {
    return NextResponse.json({ error: "team_required" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (body.alertType === "player" && !body.playerId) {
    return NextResponse.json({ error: "player_required" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const tracked = await isTrackedLiveFixture(body.fixtureId);
  if (!tracked) {
    const details = await fetchMatchDetails(body.fixtureId);
    if (!details || !isMonitoredLiveMatch(details)) {
      return NextResponse.json({ error: "competition_not_allowed" }, { status: 403, headers: NO_STORE_HEADERS });
    }
  }
  const alert = await insertAlert({
    userId: user.id,
    fixtureId: body.fixtureId,
    alertType: body.alertType,
    teamId: body.teamId,
    playerId: body.playerId,
    statisticName: body.statisticName,
    targetValue: clampTarget(body.statisticName, body.alertType, body.targetValue),
    subjectName: body.subjectName,
    locale: body.locale
  });
  await recountAndSyncActiveMatch(body.fixtureId);
  return NextResponse.json({ alert }, { status: 201, headers: NO_STORE_HEADERS });
}
