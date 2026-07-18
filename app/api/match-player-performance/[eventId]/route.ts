import { NextResponse } from "next/server";

import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { getStoredMatchPlayerPerformance } from "@/lib/player-performance/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const ctx = await resolveApiAccessContext(_request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const { eventId: raw } = await context.params;
  const eventId = Number(raw);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 });
  }

  const loaded = await getStoredMatchPlayerPerformance(eventId, ctx.organizationId);
  if (loaded.status === "tables_missing") {
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
