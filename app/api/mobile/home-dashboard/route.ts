import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { buildUserAccessSummary } from "@/lib/auth/user-access";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildDataRefreshStatus } from "@/lib/data-refresh/status";
import {
  buildHomeDashboard,
  loadOrganizationMatches,
  parseYellowCardRows,
  pickHomeFeaturedMatch,
  prunedYellowRows
} from "@/lib/mobile/home-dashboard";
import { localizeUpcomingMatches, localizeTacticalMetrics } from "@/lib/italian-sports-display";
import { buildUnlimitedMatchUsage } from "@/lib/auth/user-access";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export const dynamic = "force-dynamic";

function pickFeaturedEventId(matches: UpcomingMatchItem[]): number | null {
  return pickHomeFeaturedMatch(matches)?.eventId ?? null;
}

function guestAccessSummary() {
  return {
    role: "member" as const,
    isAdmin: false,
    isPro: false,
    isMember: false,
    canRefreshData: false,
    matchUsage: {
      used: 0,
      limit: null,
      remaining: null,
      eventIds: [],
      weekStartsAt: new Date().toISOString()
    },
    yellowCardVisibleRows: 3
  };
}

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const apiUser = await getApiUser(request);

  const accessRaw =
    ctx.mode === "authenticated" && ctx.userId
      ? await buildUserAccessSummary(ctx.userId, ctx.role as "admin" | "pro" | "member")
      : guestAccessSummary();

  /** Beta pubblica app mobile: dashboard senza limiti Pro per gli utenti Free autenticati. */
  const access =
    isBetaFreeForAllRequest(request, ctx.userId) && !accessRaw.isPro
      ? { ...accessRaw, isPro: true, matchUsage: buildUnlimitedMatchUsage(), yellowCardVisibleRows: null }
      : accessRaw;

  const matches = localizeUpcomingMatches(
    await loadOrganizationMatches(ctx.supabase, ctx.organizationId)
  );

  const { data: yellowRow } = await ctx.supabase
    .from("organization_yellow_card_snapshot")
    .select("snapshot")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const rawYellowRows = parseYellowCardRows(yellowRow?.snapshot);
  const yellowRows = prunedYellowRows(matches, rawYellowRows);

  const featuredEventId = pickFeaturedEventId(matches);

  let featuredMetrics: TacticalMetrics[] = [];
  if (featuredEventId != null) {
    const { data: insightsRow } = await ctx.supabase
      .from("kiosk_organization_match_insights")
      .select("metrics")
      .eq("organization_id", ctx.organizationId)
      .eq("event_id", featuredEventId)
      .maybeSingle();

    featuredMetrics = Array.isArray(insightsRow?.metrics)
      ? localizeTacticalMetrics(insightsRow.metrics as TacticalMetrics[])
      : [];
  }

  const email = apiUser?.email ?? "";
  const dataRefresh = await buildDataRefreshStatus(ctx.organizationId);

  const payload = buildHomeDashboard({
    email,
    access,
    matches,
    yellowRows,
    featuredMetrics,
    featuredEventId,
    guestMode: ctx.mode === "guest",
    dataRefresh
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}
