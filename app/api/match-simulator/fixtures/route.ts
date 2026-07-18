import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import {
  buildMatchSimulatorFixturesResponse,
  parseMatchSimulatorListQuery
} from "@/lib/match-simulator/api-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = parseMatchSimulatorListQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = await buildMatchSimulatorFixturesResponse({
    organizationId: ctx.organizationId,
    competitionId: parsed.data.competitionId,
    round: parsed.data.round
  });

  return NextResponse.json(payload);
}
