import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { handleFantaSearch } from "@/lib/fanta/api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }
  const url = new URL(request.url);
  const payload = await handleFantaSearch({
    organizationId: ctx.organizationId,
    searchParams: url.searchParams
  });
  return NextResponse.json(payload);
}
