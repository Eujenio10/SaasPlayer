import {
  REFEREE_SEVERITY_MIN_MATCHES,
  type RefereeCardFixtureTotals,
  type RefereeSeverityStats
} from "@/lib/referee-severity/types";

/** Un team non può prendere 217 rossi: sopra queste soglie il valore non è un cartellino. */
export const MAX_PLAUSIBLE_TEAM_YELLOW_CARDS = 15;
export const MAX_PLAUSIBLE_TEAM_RED_CARDS = 5;
export const MAX_PLAUSIBLE_MATCH_YELLOW_AVERAGE = 20;
export const MAX_PLAUSIBLE_MATCH_RED_AVERAGE = 3;

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function sanitizeTeamCardCount(value: number | null | undefined, max: number): number | null {
  if (value == null || !Number.isFinite(value) || value < 0 || value > max) return null;
  return value;
}

/** Aggrega le due righe squadra-partita in totali cartellini per fixture. */
export function aggregateRefereeFixturesFromTeamRows(
  rows: Array<{
    fixtureId: string;
    yellowCards: number | null;
    redCards: number | null;
  }>
): RefereeCardFixtureTotals[] {
  const byFixture = new Map<string, RefereeCardFixtureTotals>();
  for (const row of rows) {
    const fixtureId = row.fixtureId?.trim();
    if (!fixtureId) continue;
    const yellow = sanitizeTeamCardCount(row.yellowCards, MAX_PLAUSIBLE_TEAM_YELLOW_CARDS);
    const red = sanitizeTeamCardCount(row.redCards, MAX_PLAUSIBLE_TEAM_RED_CARDS);
    const current = byFixture.get(fixtureId) ?? { yellowCards: 0, redCards: 0 };
    current.yellowCards += yellow ?? 0;
    current.redCards += red ?? 0;
    byFixture.set(fixtureId, current);
  }
  return [...byFixture.values()];
}

export function refereeCardAverage(stats: RefereeSeverityStats | null | undefined): number {
  if (!stats || stats.matchesCount <= 0) return -1;
  return stats.yellowAverage + stats.redAverage;
}

export function refereeStatsLookPlausible(stats: RefereeSeverityStats | null | undefined): boolean {
  if (!stats) return true;
  return (
    stats.yellowAverage >= 0 &&
    stats.yellowAverage <= MAX_PLAUSIBLE_MATCH_YELLOW_AVERAGE &&
    stats.redAverage >= 0 &&
    stats.redAverage <= MAX_PLAUSIBLE_MATCH_RED_AVERAGE
  );
}

/**
 * Media cartellini della stagione: (gialli + rossi) / partite dirette.
 * severityScore è quella media, usata per ordinare le partite.
 */
export function computeRefereeCardAverages(params: {
  refereeId: string;
  refereeName: string;
  fixtures: RefereeCardFixtureTotals[];
  minimumMatches?: number;
}): RefereeSeverityStats {
  const minMatches = params.minimumMatches ?? REFEREE_SEVERITY_MIN_MATCHES;
  const matchesCount = params.fixtures.length;
  const yellowTotal = params.fixtures.reduce((acc, row) => acc + row.yellowCards, 0);
  const redTotal = params.fixtures.reduce((acc, row) => acc + row.redCards, 0);
  const yellowAverage = matchesCount > 0 ? yellowTotal / matchesCount : 0;
  const redAverage = matchesCount > 0 ? redTotal / matchesCount : 0;
  const severityScore = yellowAverage + redAverage;

  return {
    refereeId: params.refereeId,
    refereeName: params.refereeName,
    matchesCount,
    yellowAverage: round1(yellowAverage),
    redAverage: round2(redAverage),
    severityScore: round2(severityScore),
    sufficientSample: matchesCount >= minMatches
  };
}

/** Dalla media cartellini più alta alla più bassa; senza dati in fondo. */
export function sortMatchesByRefereeSeverity<T extends { stats: RefereeSeverityStats | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aScore = refereeCardAverage(a.stats);
    const bScore = refereeCardAverage(b.stats);
    if (bScore !== aScore) return bScore - aScore;
    const aYellow = a.stats?.yellowAverage ?? -1;
    const bYellow = b.stats?.yellowAverage ?? -1;
    if (bYellow !== aYellow) return bYellow - aYellow;
    const aHasReferee = a.stats != null ? 1 : 0;
    const bHasReferee = b.stats != null ? 1 : 0;
    return bHasReferee - aHasReferee;
  });
}
