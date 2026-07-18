import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionScope, TacticalMetrics } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCompetitionSlugForInsights } from "@/lib/match-insights-service";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import {
  ensureTeamTournamentBlueprintsForMatch,
  teamBlueprintFromProviderOnly
} from "@/lib/prematch-report/ensure-team-tournament-blueprints";
import { scopeFromCompetitionSlugForInsights } from "@/lib/tactical-stats-eligible-matches";
import {
  translateCompetitionSlug,
  translateTeamName
} from "@/lib/italian-sports-display";
import { fetchEventSeasonContextForInsights, fetchTeamPerformanceBlueprint } from "@/services/sportapi";
import { isBlueprintPerMatchPlausible } from "@/lib/prematch-report/blueprint-validation";
import { buildTeamFormSignalsReport } from "./compute-report";
import type { TeamFormSignalsReport } from "./types";

function competitionSlugKey(raw: string | undefined): string {
  return raw?.trim().toLowerCase().slice(0, 120) ?? "";
}

async function resolveSeasonContextForBlueprint(eventId?: number): Promise<{
  tournamentId?: number;
  seasonId?: number;
}> {
  if (!eventId || !Number.isFinite(eventId)) return {};
  const ctx = await fetchEventSeasonContextForInsights(eventId).catch(() => null);
  if (!ctx) return {};
  return { tournamentId: ctx.tournamentId, seasonId: ctx.seasonId };
}

export async function persistTeamBlueprintForMatch(params: {
  supabase?: SupabaseClient;
  organizationId: string;
  teamId: number;
  teamName: string;
  competitionSlug: string;
  scope: CompetitionScope;
  eventId?: number;
  tournamentId?: number;
  seasonId?: number;
  forceRefresh?: boolean;
}): Promise<boolean> {
  const supabase = params.supabase ?? createSupabaseServerClient();
  try {
    let tournamentId = params.tournamentId;
    let seasonId = params.seasonId;
    if ((!tournamentId || !seasonId) && params.eventId) {
      const ctx = await resolveSeasonContextForBlueprint(params.eventId);
      tournamentId = tournamentId ?? ctx.tournamentId;
      seasonId = seasonId ?? ctx.seasonId;
    }

    const blueprint = await fetchTeamPerformanceBlueprint({
      teamId: params.teamId,
      teamName: params.teamName,
      competitionSlug: params.competitionSlug,
      scope: params.scope,
      tournamentId,
      seasonId,
      forceRefresh: params.forceRefresh ?? false
    });

    if (!isBlueprintPerMatchPlausible(blueprint)) return false;

    const { error } = await supabase.from("organization_team_performance_snapshot").upsert(
      {
        organization_id: params.organizationId,
        team_id: params.teamId,
        scope: params.scope,
        competition_slug_key: competitionSlugKey(params.competitionSlug),
        blueprint: blueprint as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,team_id,scope,competition_slug_key" }
    );

    return !error;
  } catch (error) {
    console.warn(
      `[team-form-signals] blueprint_persist_failed team=${params.teamId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

export async function buildTeamFormSignalsForOrganizationMatch(params: {
  supabase: SupabaseClient;
  organizationId: string;
  eventId: number;
  metrics: TacticalMetrics[];
  forceRefresh?: boolean;
  allowProviderFetch?: boolean;
}): Promise<TeamFormSignalsReport | null> {
  const match = await findOrganizationMatchByEventId(params.organizationId, params.eventId);
  if (!match) return null;

  const competitionSlug = normalizeCompetitionSlugForInsights(match.competitionSlug);
  const scope = scopeFromCompetitionSlugForInsights(match.competitionSlug);
  const homeTeamName = translateTeamName(match.homeTeam.name);
  const awayTeamName = translateTeamName(match.awayTeam.name);
  const competitionName = translateCompetitionSlug(match.competitionSlug ?? "", match.competitionName);

  const tournamentBlueprints = await ensureTeamTournamentBlueprintsForMatch({
    supabase: params.supabase,
    organizationId: params.organizationId,
    eventId: params.eventId,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    competitionSlug,
    scope,
    forceRefresh: params.forceRefresh ?? false,
    allowProviderFetch: params.allowProviderFetch === true
  });

  const homeBlueprint = teamBlueprintFromProviderOnly(tournamentBlueprints.home);
  const awayBlueprint = teamBlueprintFromProviderOnly(tournamentBlueprints.away);

  return buildTeamFormSignalsReport({
    metrics: params.metrics,
    eventId: params.eventId,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    homeTeamName,
    awayTeamName,
    competition: competitionName,
    kickoff: new Date(match.startTimestamp * 1000).toISOString(),
    homeBlueprint,
    awayBlueprint,
    homeBlueprintPersisted: homeBlueprint,
    awayBlueprintPersisted: awayBlueprint,
    providerTournamentStats: tournamentBlueprints.providerAvailable
  });
}
