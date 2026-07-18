import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { buildDataRefreshStatus } from "@/lib/data-refresh/status";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const status = await buildDataRefreshStatus(ctx.organizationId);

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}
