import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { isMatchRadarProAccess } from "@/lib/match-radar/access";
import {
  buildMatchRadarListResponse,
  parseMatchRadarListQuery
} from "@/lib/match-radar/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = parseMatchRadarListQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = await buildMatchRadarListResponse({
    date: parsed.data.date,
    mode: parsed.data.mode,
    competitionId: parsed.data.competitionId,
    locale: parsed.data.locale,
    isPro: isMatchRadarProAccess(ctx)
  });

  return NextResponse.json(payload);
}
