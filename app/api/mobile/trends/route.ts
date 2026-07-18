import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildTrendsListResponse, parseTrendsListQuery } from "@/lib/trends/api-handlers";
import { redactTrendsList } from "@/lib/entitlements";
import { resolveRequestEntitlements } from "@/lib/entitlements/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = parseTrendsListQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const entitlements = await resolveRequestEntitlements(ctx, request);
  const allowAdvancedFilters = entitlements.subscriptionTier === "pro";
  const payload = await buildTrendsListResponse({
    organizationId: ctx.organizationId,
    competitionId: parsed.data.competitionId,
    round: parsed.data.round,
    metric: allowAdvancedFilters ? parsed.data.metric : "all",
    reliability: allowAdvancedFilters ? parsed.data.reliability : "all"
  });

  const redacted = redactTrendsList({
    results: payload.results,
    tier: entitlements.subscriptionTier
  });

  return NextResponse.json({
    ...payload,
    results: redacted.results,
    accessMode: redacted.accessMode,
    totalAvailable: redacted.totalAvailable,
    freeLimit: redacted.freeLimit,
    lockedCount: redacted.lockedCount,
    subscriptionTier: entitlements.subscriptionTier,
    filtersLocked: !allowAdvancedFilters
  });
}
