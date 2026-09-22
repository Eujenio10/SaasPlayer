import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";
import { fetchMatchDetails, fetchMatchLineupPlayers, isMonitoredLiveMatch } from "@/lib/live-alerts/footapi-service";
import { listUserAlerts } from "@/lib/live-alerts/persist";
import { getApiUser } from "@/lib/auth/get-api-user";
import { readMatchCache } from "@/lib/live-alerts/persist";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> | { eventId: string } }) {
  const params = await Promise.resolve(context.params);
  const eventId = Number(params.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const cached = await readMatchCache(eventId);
  const snapshot = cached ?? (await fetchMatchDetails(eventId));
  if (!snapshot) {
    return NextResponse.json({ error: "match_unavailable" }, { status: 404, headers: NO_STORE_HEADERS });
  }
  if (!cached && !isMonitoredLiveMatch(snapshot)) {
    return NextResponse.json({ error: "competition_not_allowed" }, { status: 404, headers: NO_STORE_HEADERS });
  }
  const players = await fetchMatchLineupPlayers(eventId);
  const user = await getApiUser(request);
  const alerts = user ? await listUserAlerts(user.id, eventId) : [];
  return NextResponse.json(
    {
      match: snapshot,
      players: players.map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        teamId: player.teamId
      })),
      alerts
    },
    { headers: NO_STORE_HEADERS }
  );
}
