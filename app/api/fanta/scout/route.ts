import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { handleFantaScout } from "@/lib/fanta/api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }
  const payload = await handleFantaScout({
    organizationId: ctx.organizationId,
    searchParams: new URL(request.url).searchParams
  });
  if ("error" in payload) {
    return NextResponse.json(payload, { status: payload.error === "missing_player" ? 400 : 404 });
  }
  return NextResponse.json(payload);
}
