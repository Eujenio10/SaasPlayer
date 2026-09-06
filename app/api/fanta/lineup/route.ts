import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { handleFantaDuel } from "@/lib/fanta/api-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusForError(error: string | undefined): number {
  if (error === "role_mismatch" || error === "same_player" || error === "missing_players" || error === "invalid_body") {
    return 400;
  }
  if (error === "not_found") return 404;
  return 400;
}

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }
  const payload = await handleFantaDuel({
    organizationId: ctx.organizationId,
    searchParams: new URL(request.url).searchParams
  });
  if ("error" in payload) {
    return NextResponse.json(payload, { status: statusForError(payload.error) });
  }
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const payload = await handleFantaDuel({
    organizationId: ctx.organizationId,
    body
  });
  if ("error" in payload) {
    return NextResponse.json(payload, { status: statusForError(payload.error) });
  }
  return NextResponse.json(payload);
}
