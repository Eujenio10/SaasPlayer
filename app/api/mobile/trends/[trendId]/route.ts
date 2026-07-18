import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildTrendDetailResponse } from "@/lib/trends/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ trendId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const { trendId } = await context.params;
  const payload = await buildTrendDetailResponse({
    organizationId: ctx.organizationId,
    trendId: decodeURIComponent(trendId)
  });

  if (!payload.trend) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
