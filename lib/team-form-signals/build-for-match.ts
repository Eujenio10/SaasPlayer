import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionScope } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchEventSeasonContextForInsights, fetchTeamPerformanceBlueprint } from "@/services/sportapi";
import { isBlueprintPerMatchPlausible } from "@/lib/prematch-report/blueprint-validation";

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
