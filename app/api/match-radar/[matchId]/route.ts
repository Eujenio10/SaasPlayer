import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { resolveRequestEntitlements } from "@/lib/entitlements/request";
import { isMatchRadarProAccess } from "@/lib/match-radar/access";
import { buildMatchRadarDetailApiResponse } from "@/lib/match-radar/api-handlers";
import { matchRadarEmptyMessage, resolveLocale } from "@/lib/match-radar/text";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ matchId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const { matchId } = await context.params;
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const entitlements = await resolveRequestEntitlements(ctx, request);

  const { detail, emptyReason } = await buildMatchRadarDetailApiResponse({
    matchId,
    locale,
    isPro: isMatchRadarProAccess(ctx, entitlements.subscriptionTier)
  });

  if (!detail) {
    return NextResponse.json(
      {
        error: "not_found",
        message: matchRadarEmptyMessage(locale, emptyReason)
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ detail, locale });
}
