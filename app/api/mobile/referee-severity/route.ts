import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { getCompetitionLabel } from "@/lib/competitions";
import { getRefereeSeverityRound } from "@/lib/referee-severity/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId")?.trim() || DEFAULT_MENU_COMPETITION_ID;
  const forceRefresh = url.searchParams.get("refresh") === "1";

  try {
    const payload = await getRefereeSeverityRound({
      organizationId: ctx.organizationId,
      competitionId,
      forceRefresh
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.warn("[referee-severity] route_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({
      competitionId,
      competitionName: getCompetitionLabel(competitionId),
      seasonId: null,
      round: null,
      matches: [],
      availableCompetitionIds: [competitionId],
      updatedAt: null
    });
  }
}
