import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import {
  buildDifficultMarkingsListResponse,
  parseDifficultMarkingsListQuery
} from "@/lib/difficult-markings/api-handlers";
import { redactDifficultMarkingsList } from "@/lib/entitlements";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";
import { resolveRequestEntitlements } from "@/lib/entitlements/request";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  /** Beta app mobile: i guest hanno lo stesso accesso dei Free, niente auth obbligatoria. */
  if ((ctx.mode === "guest" || ctx.role === "guest") && !isBetaFreeForAllRequest(request)) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = parseDifficultMarkingsListQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const entitlements = await resolveRequestEntitlements(ctx, request);
  const payload = await buildDifficultMarkingsListResponse({
    organizationId: ctx.organizationId,
    competitionId: parsed.data.competitionId,
    round: parsed.data.round,
    filter: parsed.data.filter as never,
    sort: parsed.data.sort as never,
    eventId: parsed.data.eventId
  });

  const redacted = redactDifficultMarkingsList({
    results: payload.results,
    tier: entitlements.subscriptionTier
  });

  return NextResponse.json(
    {
      ...payload,
      results: redacted.results,
      accessMode: redacted.accessMode,
      totalAvailable: redacted.totalAvailable,
      freeLimit: redacted.freeLimit,
      lockedCount: redacted.lockedCount,
      subscriptionTier: entitlements.subscriptionTier
    },
    { headers: NO_STORE_HEADERS }
  );
}
