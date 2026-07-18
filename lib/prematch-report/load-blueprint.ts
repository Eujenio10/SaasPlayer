import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionScope, TacticalMetrics, TeamPerformanceBlueprint } from "@/lib/types";
import { isBlueprintPerMatchPlausible } from "./blueprint-validation";

function competitionSlugKey(raw: string | undefined): string {
  return raw?.trim().toLowerCase().slice(0, 120) ?? "";
}

export async function loadPersistedTeamBlueprint(
  supabase: SupabaseClient,
  organizationId: string,
  teamId: number,
  scope: CompetitionScope,
  competitionSlug: string
): Promise<TeamPerformanceBlueprint | null> {
  const slugKey = competitionSlugKey(competitionSlug);
  const { data } = await supabase
    .from("organization_team_performance_snapshot")
    .select("blueprint")
    .eq("organization_id", organizationId)
    .eq("team_id", teamId)
    .eq("scope", scope)
    .eq("competition_slug_key", slugKey)
    .maybeSingle();

  if (data?.blueprint && typeof data.blueprint === "object") {
    const blueprint = data.blueprint as TeamPerformanceBlueprint;
    if (isBlueprintPerMatchPlausible(blueprint)) return blueprint;
  }
  return null;
}

/** Solo statistiche torneo da provider (FootApi). Nessun fallback da metriche giocatore. */
export function resolveTeamBlueprint(
  persisted: TeamPerformanceBlueprint | null,
  _metrics: TacticalMetrics[],
  _teamId: number,
  _teamName: string,
  _opponentTeamId: number,
  _scope: CompetitionScope
): TeamPerformanceBlueprint | null {
  if (persisted && isBlueprintPerMatchPlausible(persisted)) return persisted;
  return null;
}
