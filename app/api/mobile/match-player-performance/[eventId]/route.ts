import { NextResponse } from "next/server";

import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { requestHasMatchUnlock, resolveRequestEntitlements } from "@/lib/entitlements/request";
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

  const url = new URL(request.url);
  const entitlements = await resolveRequestEntitlements(ctx, request);
  const allowCompute =
    ctx.role === "admin" ||
    entitlements.subscriptionTier === "pro" ||
    requestHasMatchUnlock(entitlements, eventId);

  const homeTeamId = Number(url.searchParams.get("homeTeamId") ?? "");
  const awayTeamId = Number(url.searchParams.get("awayTeamId") ?? "");
  const startTimestamp = Number(url.searchParams.get("startTimestamp") ?? "");

  const loaded = await getOrComputeMatchPlayerPerformance({
    eventId,
    organizationId: ctx.organizationId,
    allowCompute,
    hints: {
      homeTeamId: Number.isFinite(homeTeamId) && homeTeamId > 0 ? homeTeamId : undefined,
      awayTeamId: Number.isFinite(awayTeamId) && awayTeamId > 0 ? awayTeamId : undefined,
      homeTeamName: url.searchParams.get("homeTeamName") ?? undefined,
      awayTeamName: url.searchParams.get("awayTeamName") ?? undefined,
      startTimestamp:
        Number.isFinite(startTimestamp) && startTimestamp > 0 ? startTimestamp : undefined
    }
  });

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
