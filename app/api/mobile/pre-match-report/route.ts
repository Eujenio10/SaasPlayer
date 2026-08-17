import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { getApiUser } from "@/lib/auth/get-api-user";
import {
  ensureConsumerOrganizationMembership,
  resolveAuthenticatedUserAccess
} from "@/lib/auth/consumer-membership";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { normalizeCompetitionSlugForInsights } from "@/lib/match-insights-service";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import {
  localizePreMatchReport,
  localizeUpcomingMatch,
  translateCompetitionSlug,
  translateTeamName
} from "@/lib/italian-sports-display";
import { generatePreMatchReport } from "@/lib/prematch-report";
import {
  ensureTeamTournamentBlueprintsForMatch,
  teamBlueprintFromProviderOnly
} from "@/lib/prematch-report/ensure-team-tournament-blueprints";
import { scopeFromCompetitionSlugForInsights } from "@/lib/tactical-stats-eligible-matches";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";

const querySchema = z.object({
  eventId: z.coerce.number().int().positive()
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  const beta = isBetaFreeForAllRequest(request, user?.id);

  if (!user && !beta) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  /** Beta pubblica app mobile: report completo anche per Free autenticati e guest. */
  const accessRaw = user ? await resolveAuthenticatedUserAccess(user.id) : null;
  if (user) await ensureConsumerOrganizationMembership(user.id);

  const access =
    beta && !accessRaw?.isPro
      ? { ...(accessRaw ?? { isAdmin: false, isPro: false }), isPro: true }
      : accessRaw ?? { isAdmin: false, isPro: false };

  if (!access.isPro && !access.isAdmin) {
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  }

  const isAdmin = access.isAdmin;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ eventId: url.searchParams.get("eventId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const eventId = parsed.data.eventId;
  const productOrganizationId = await resolveProductOrganizationId();
  if (!productOrganizationId) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const cacheKey = `prematch_report:v7:${productOrganizationId}:${eventId}`;
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getApiCache<{ report: NonNullable<ReturnType<typeof generatePreMatchReport>> }>(
      cacheKey
    );
    if (cached?.report) {
      return NextResponse.json({ report: localizePreMatchReport(cached.report), cached: true });
    }
  }

  const rawMatch = await findOrganizationMatchByEventId(productOrganizationId, eventId);
  if (!rawMatch) {
    return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  }

  const match = localizeUpcomingMatch(rawMatch);
  const homeTeamName = translateTeamName(match.homeTeam.name);
  const awayTeamName = translateTeamName(match.awayTeam.name);
  const competitionName = translateCompetitionSlug(match.competitionSlug ?? "", match.competitionName);

  const supabase = createSupabaseServiceClient();
  const competitionSlug = normalizeCompetitionSlugForInsights(match.competitionSlug);
  const scope = scopeFromCompetitionSlugForInsights(match.competitionSlug);

  const tournamentBlueprints = await ensureTeamTournamentBlueprintsForMatch({
    supabase,
    organizationId: productOrganizationId,
    eventId,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    competitionSlug,
    scope,
    forceRefresh: isAdmin && forceRefresh,
    /** Pro/admin: se manca lo snapshot blueprint, recupera dal provider (non solo admin+refresh). */
    allowProviderFetch: isAdmin || access.isPro
  });

  const homeBlueprint = teamBlueprintFromProviderOnly(tournamentBlueprints.home);
  const awayBlueprint = teamBlueprintFromProviderOnly(tournamentBlueprints.away);

  const reportRaw = generatePreMatchReport({
    eventId,
    homeTeamName,
    awayTeamName,
    competitionName,
    competitionSlug,
    kickoffTimestamp: match.startTimestamp,
    homeBlueprint,
    awayBlueprint,
    homeShotsSeasonAvg: undefined,
    homeShotsLastFiveAvg: undefined,
    awayShotsSeasonAvg: undefined,
    awayShotsLastFiveAvg: undefined
  });

  if (!reportRaw) {
    const missingHome = !homeBlueprint;
    const missingAway = !awayBlueprint;
    return NextResponse.json(
      {
        error: "insufficient_data",
        message: !tournamentBlueprints.providerAvailable
          ? "Contesto torneo/stagione non disponibile per questa partita."
          : missingHome && missingAway
            ? "Statistiche torneo non disponibili da FootApi per questa partita."
            : `Statistiche torneo incomplete (${missingHome ? "casa" : "trasferta"} mancanti).`
      },
      { status: 422 }
    );
  }

  const report = localizePreMatchReport(reportRaw);

  await setApiCache(cacheKey, { report: reportRaw }, 6);

  return NextResponse.json({ report, cached: false });
}
