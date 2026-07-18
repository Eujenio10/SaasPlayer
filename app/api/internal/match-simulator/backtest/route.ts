import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { runTemporalBacktest } from "@/lib/match-simulator/backtest";
import { loadCompetitionTeamMatchStats } from "@/lib/match-simulator/persist";
import { resolveCompetitionId } from "@/lib/competitions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    competitionId?: string;
    seasonId?: string;
    maxFixtures?: number;
  };

  const competitionId = resolveCompetitionId(body.competitionId ?? "serie-a") ?? "serie-a";
  const seasonId = body.seasonId ?? "unknown";
  const rows = await loadCompetitionTeamMatchStats({
    competitionId,
    seasonId,
    limit: 500
  });

  const summary = runTemporalBacktest({
    rows,
    maxFixtures: body.maxFixtures ?? 8,
    simulationsCount: 1200
  });

  return NextResponse.json({
    ok: true,
    competitionId,
    seasonId,
    summary
  });
}
