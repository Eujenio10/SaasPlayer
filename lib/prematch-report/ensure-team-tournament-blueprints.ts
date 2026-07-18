import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionScope, TeamPerformanceBlueprint } from "@/lib/types";
import { fetchEventSeasonContextForInsights, fetchTeamPerformanceBlueprint } from "@/services/sportapi";
import { isBlueprintPerMatchPlausible } from "./blueprint-validation";
import { loadPersistedTeamBlueprint } from "./load-blueprint";

function competitionSlugKey(raw: string | undefined): string {
  return raw?.trim().toLowerCase().slice(0, 120) ?? "";
}

async function persistBlueprintRow(params: {
  supabase: SupabaseClient;
  organizationId: string;
  teamId: number;
  scope: CompetitionScope;
  competitionSlug: string;
  blueprint: TeamPerformanceBlueprint;
}): Promise<void> {
  await params.supabase.from("organization_team_performance_snapshot").upsert(
    {
      organization_id: params.organizationId,
      team_id: params.teamId,
      scope: params.scope,
      competition_slug_key: competitionSlugKey(params.competitionSlug),
      blueprint: params.blueprint as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id,team_id,scope,competition_slug_key" }
  );
}

async function fetchBlueprintFromProvider(params: {
  teamId: number;
  teamName: string;
  competitionSlug: string;
  scope: CompetitionScope;
  eventId: number;
  tournamentId: number;
  seasonId: number;
  forceRefresh: boolean;
}): Promise<TeamPerformanceBlueprint | null> {
  try {
    const blueprint = await fetchTeamPerformanceBlueprint({
      teamId: params.teamId,
      teamName: params.teamName,
      competitionSlug: params.competitionSlug,
      scope: params.scope,
      tournamentId: params.tournamentId,
      seasonId: params.seasonId,
      forceRefresh: params.forceRefresh
    });
    return isBlueprintPerMatchPlausible(blueprint) ? blueprint : null;
  } catch (error) {
    console.warn(
      `[team-tournament-blueprints] fetch_failed team=${params.teamId} event=${params.eventId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export interface TeamTournamentBlueprintsResult {
  home: TeamPerformanceBlueprint | null;
  away: TeamPerformanceBlueprint | null;
  tournamentId?: number;
  seasonId?: number;
  providerAvailable: boolean;
}

/**
 * Carica le statistiche squadra del torneo analizzato da FootApi
 * (`/api/team/{id}/tournament/{tid}/season/{sid}/statistics`).
 * Usare come unica fonte per Forma Squadre e Pre-Partita (non metriche giocatore).
 */
export async function ensureTeamTournamentBlueprintsForMatch(params: {
  supabase: SupabaseClient;
  organizationId: string;
  eventId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  competitionSlug: string;
  scope: CompetitionScope;
  forceRefresh?: boolean;
  /** Solo admin refresh: evita chiamate SportAPI lente per guest/member/pro. */
  allowProviderFetch?: boolean;
}): Promise<TeamTournamentBlueprintsResult> {
  const allowProviderFetch = params.allowProviderFetch === true;
  const seasonCtx = allowProviderFetch
    ? await fetchEventSeasonContextForInsights(params.eventId).catch(() => null)
    : null;
  const tournamentId = seasonCtx?.tournamentId;
  const seasonId = seasonCtx?.seasonId;
  const hasSeasonContext = Boolean(tournamentId && tournamentId > 0 && seasonId && seasonId > 0);

  async function resolveTeamBlueprint(
    teamId: number,
    teamName: string
  ): Promise<TeamPerformanceBlueprint | null> {
    const persisted = await loadPersistedTeamBlueprint(
      params.supabase,
      params.organizationId,
      teamId,
      params.scope,
      params.competitionSlug
    );

    if (persisted && !params.forceRefresh) {
      return persisted;
    }

    if (!allowProviderFetch || !hasSeasonContext) {
      return persisted;
    }

    const fromProvider = await fetchBlueprintFromProvider({
      teamId,
      teamName,
      competitionSlug: params.competitionSlug,
      scope: params.scope,
      eventId: params.eventId,
      tournamentId: tournamentId as number,
      seasonId: seasonId as number,
      forceRefresh: params.forceRefresh ?? false
    });

    if (fromProvider) {
      await persistBlueprintRow({
        supabase: params.supabase,
        organizationId: params.organizationId,
        teamId,
        scope: params.scope,
        competitionSlug: params.competitionSlug,
        blueprint: fromProvider
      });
      return fromProvider;
    }

    return persisted;
  }

  const [home, away] = await Promise.all([
    resolveTeamBlueprint(params.homeTeamId, params.homeTeamName),
    resolveTeamBlueprint(params.awayTeamId, params.awayTeamName)
  ]);

  return {
    home,
    away,
    tournamentId,
    seasonId,
    providerAvailable: hasSeasonContext
  };
}

export function teamBlueprintFromProviderOnly(
  blueprint: TeamPerformanceBlueprint | null | undefined
): TeamPerformanceBlueprint | null {
  if (!blueprint || !isBlueprintPerMatchPlausible(blueprint)) return null;
  return blueprint;
}
