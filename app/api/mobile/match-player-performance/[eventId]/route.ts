import { NextResponse } from "next/server";

import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { allowSnapshotComputeIfMissing } from "@/lib/entitlements/config";
import { parseMatchPlayerPerformanceHints } from "@/lib/player-performance/hints";
import { getOrComputeMatchPlayerPerformance } from "@/lib/player-performance/api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const { eventId: raw } = await context.params;
  const eventId = Number(raw);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 });
  }

  const hints = parseMatchPlayerPerformanceHints(request);

  const loaded = await getOrComputeMatchPlayerPerformance({
    eventId,
    organizationId: ctx.organizationId,
    allowCompute: allowSnapshotComputeIfMissing(request),
    hints: hints
      ? {
          homeTeamId: hints.homeTeam?.id,
          awayTeamId: hints.awayTeam?.id,
          homeTeamName: hints.homeTeam?.name,
          awayTeamName: hints.awayTeam?.name,
          startTimestamp: hints.startTimestamp
        }
      : undefined
  });

  if (loaded.status === "match_started") {
    return NextResponse.json({ error: "player_performance_match_started" }, { status: 410 });
  }
  if (loaded.status === "tables_missing" && !loaded.payload) {
    return NextResponse.json(
      { error: "player_performance_snapshot_unavailable" },
      { status: 503 }
    );
  }
  if (!loaded.payload) {
    return NextResponse.json(
      { error: "player_performance_not_ready" },
      { status: 404 }
    );
  }

  return NextResponse.json(loaded.payload, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}
