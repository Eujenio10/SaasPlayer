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
  const { data: rows } = await supabase
    .from("organization_team_performance_snapshot")
    .select("blueprint")
    .eq("organization_id", organizationId)
    .eq("team_id", teamId)
    .eq("scope", scope)
    .eq("competition_slug_key", slugKey)
    .limit(1);

  const data = Array.isArray(rows) ? rows[0] : rows;

  if (data?.blueprint && typeof data.blueprint === "object") {
    const blueprint = data.blueprint as TeamPerformanceBlueprint;
    if (isBlueprintPerMatchPlausible(blueprint)) return blueprint;
  }
  return null;
}

/** True solo se lo snapshot è stato costruito sul torneo/stagione della partita (non l'annata scorsa). */
export function blueprintMatchesSeasonContext(
  blueprint: TeamPerformanceBlueprint | null | undefined,
  tournamentId?: number,
  seasonId?: number
): boolean {
  if (!blueprint || !tournamentId || tournamentId <= 0 || !seasonId || seasonId <= 0) return false;
  return (
    Number(blueprint.tournamentId) === Number(tournamentId) &&
    Number(blueprint.seasonId) === Number(seasonId)
  );
}

/** Solo statistiche torneo da provider (FootApi). Nessun fallback da metriche giocatore. */
export function resolveTeamBlueprint(
  persisted: TeamPerformanceBlueprint | null,
  metrics: TacticalMetrics[],
  teamId: number,
  teamName: string,
  opponentTeamId: number,
  scope: CompetitionScope
): TeamPerformanceBlueprint | null {
  void metrics;
  void teamId;
  void teamName;
  void opponentTeamId;
  void scope;
  if (persisted && isBlueprintPerMatchPlausible(persisted)) return persisted;
  return null;
}
