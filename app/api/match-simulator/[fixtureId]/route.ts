import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildMatchSimulatorDetailResponse } from "@/lib/match-simulator/api-handlers";
import { redactSimulationDetail } from "@/lib/entitlements";
import { requestHasMatchUnlock, resolveRequestEntitlements } from "@/lib/entitlements/request";

export const dynamic = "force-dynamic";
/** On-demand simulation può scaricare stats FootAPI. */
export const maxDuration = 120;

export async function GET(
  request: Request,
  context: { params: Promise<{ fixtureId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const { fixtureId } = await context.params;
  const entitlements = await resolveRequestEntitlements(ctx, request);
  const matchUnlocked = requestHasMatchUnlock(entitlements, fixtureId);
  const canGenerate =
    ctx.role === "admin" ||
    entitlements.subscriptionTier === "pro" ||
    matchUnlocked;

  const payload = await buildMatchSimulatorDetailResponse({
    organizationId: ctx.organizationId,
    fixtureId,
    generateIfMissing: canGenerate
  });

  const redacted = redactSimulationDetail({
    simulation: payload.simulation,
    tier: entitlements.subscriptionTier,
    matchUnlocked,
    authenticatedFree: Boolean(ctx.userId) && entitlements.subscriptionTier !== "pro"
  });

  return NextResponse.json({
    ...payload,
    simulation: redacted.simulation,
    accessMode: redacted.accessMode,
    matchUnlocked,
    subscriptionTier: entitlements.subscriptionTier,
    rewardedUnlocksRemaining: entitlements.rewardedUnlocksRemaining
  });
}
