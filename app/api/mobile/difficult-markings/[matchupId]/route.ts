import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildDifficultMarkingsDetailResponse } from "@/lib/difficult-markings/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ matchupId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  if (ctx.mode === "guest" || ctx.role === "guest") {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { matchupId } = await context.params;
  if (!matchupId?.trim()) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const detail = await buildDifficultMarkingsDetailResponse({
    organizationId: ctx.organizationId,
    matchupId: decodeURIComponent(matchupId)
  });

  if (!detail.ok) {
    return NextResponse.json({ error: detail.error }, { status: detail.status });
  }

  return NextResponse.json({
    matchup: detail.matchup,
    updatedAt: detail.updatedAt
  });
}
