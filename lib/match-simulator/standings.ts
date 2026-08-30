import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";
import {
  buildStandingsAdjustment,
  neutralStandingsAdjustment,
  reconstructStandingsFromMatchStats,
  type StandingsTableRow
} from "@/lib/match-simulator/standings-strength";
import { sportApiStandingsPath } from "@/lib/sportapi-endpoints";
import type { NormalizedTeamMatchStats, StandingsAdjustment } from "@/lib/match-simulator/types";

export { reconstructStandingsFromMatchStats, type StandingsTableRow };

function coerceNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Parse della classifica FootAPI (stesso payload della route admin standings). */
export function parseStandingsPayload(payload: unknown): StandingsTableRow[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const standings = root.standings;
  if (!Array.isArray(standings) || standings.length === 0) return [];
  const first = standings[0] as Record<string, unknown>;
  const rows = first.rows;
  if (!Array.isArray(rows)) return [];

  const out: StandingsTableRow[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const team =
      row.team && typeof row.team === "object" ? (row.team as Record<string, unknown>) : {};
    const teamId = Math.max(0, Math.round(coerceNum(team.id ?? row.teamId)));
    if (teamId <= 0) continue;
    const position = Math.max(0, Math.round(coerceNum(row.position)));
    out.push({
      teamId: String(teamId),
      position: position > 0 ? position : null,
      matches: Math.max(0, Math.round(coerceNum(row.matches))),
      points: Math.max(0, Math.round(coerceNum(row.points))),
      goalsFor: Math.max(0, Math.round(coerceNum(row.scoresFor ?? row.goalsFor))),
      goalsAgainst: Math.max(0, Math.round(coerceNum(row.scoresAgainst ?? row.goalsAgainst)))
    });
  }

  return out.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
}

export async function loadSimulatorStandings(params: {
  tournamentId: number;
  seasonId: number;
  homeTeamId: string;
  awayTeamId: string;
  historicalRows?: NormalizedTeamMatchStats[];
}): Promise<StandingsAdjustment> {
  const fallback = () => {
    const reconstructed = reconstructStandingsFromMatchStats(
      (params.historicalRows ?? []).filter((row) => row.seasonId === String(params.seasonId))
    );
    if (reconstructed.length === 0) {
      return neutralStandingsAdjustment(params.homeTeamId, params.awayTeamId);
    }
    return buildStandingsAdjustment({
      table: reconstructed,
      homeTeamId: params.homeTeamId,
      awayTeamId: params.awayTeamId,
      source: "reconstructed"
    });
  };

  try {
    const response = await footApiFetch(
      sportApiStandingsPath(params.tournamentId, params.seasonId, "total")
    );
    if (response.ok) {
      const json = (await response.json()) as unknown;
      const table = parseStandingsPayload(json);
      if (table.length > 0) {
        const fromApi = buildStandingsAdjustment({
          table,
          homeTeamId: params.homeTeamId,
          awayTeamId: params.awayTeamId,
          source: "api"
        });
        if (fromApi.source !== "none") return fromApi;
      }
    } else {
      console.warn("[match-simulator] standings_fetch_status", {
        tournamentId: params.tournamentId,
        seasonId: params.seasonId,
        status: response.status
      });
    }
  } catch (error) {
    console.warn("[match-simulator] standings_fetch_failed", {
      tournamentId: params.tournamentId,
      seasonId: params.seasonId,
      message: error instanceof Error ? error.message : "unknown"
    });
  }

  return fallback();
}
