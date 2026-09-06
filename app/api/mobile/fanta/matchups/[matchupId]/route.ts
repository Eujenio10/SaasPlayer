import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { handleFantaMatchupDetail } from "@/lib/fanta/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ matchupId: string }> }
) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }
  const { matchupId } = await context.params;
  const payload = await handleFantaMatchupDetail({
    organizationId: ctx.organizationId,
    searchParams: new URL(request.url).searchParams,
    matchupId: decodeURIComponent(matchupId)
  });
  if ("error" in payload) {
    return NextResponse.json(payload, { status: 404 });
  }
  return NextResponse.json(payload);
}
