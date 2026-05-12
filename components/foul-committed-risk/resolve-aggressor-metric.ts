import type { TacticalMetrics } from "@/lib/types";
import type { FoulRiskAggressorBrief } from "@/lib/foul-risk-analysis";

type MatchTeams = {
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
};

function foldTeam(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePlayer(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toUpperCase();
}

function teamIdForAggressorTeamName(match: MatchTeams, aggTeam: string): number | undefined {
  const t = foldTeam(aggTeam);
  const h = foldTeam(match.homeTeam.name);
  const a = foldTeam(match.awayTeam.name);
  if (!t) return undefined;
  if (t === h || h.includes(t) || t.includes(h)) return match.homeTeam.id;
  if (t === a || a.includes(t) || t.includes(a)) return match.awayTeam.id;
  return undefined;
}

/**
 * Associa una riga TacticalMetrics agli attributi sintetici dell’aggressore (solo lookup, zero ricalcolo).
 */
export function resolveAggressorMetric(
  agg: FoulRiskAggressorBrief,
  match: MatchTeams | null | undefined,
  selectedMetricsByRosterKey: Map<string, TacticalMetrics>
): TacticalMetrics | undefined {
  const nameKey = normalizePlayer(agg.playerName);
  const teamGuess = match ? teamIdForAggressorTeamName(match, agg.team) : undefined;
  if (typeof teamGuess === "number") {
    const direct = selectedMetricsByRosterKey.get(`${teamGuess}|${nameKey}`);
    if (direct) return direct;
  }
  let fallbackName: TacticalMetrics | undefined;
  let fallbackFold: TacticalMetrics | undefined;
  const wantTeam = foldTeam(agg.team);
  for (const m of selectedMetricsByRosterKey.values()) {
    if (normalizePlayer(m.playerName) === nameKey) {
      fallbackName = m;
      break;
    }
  }
  for (const m of selectedMetricsByRosterKey.values()) {
    if (foldTeam(m.team) === wantTeam && normalizePlayer(m.playerName) === nameKey) {
      fallbackFold = m;
      break;
    }
  }
  return fallbackFold ?? fallbackName;
}
