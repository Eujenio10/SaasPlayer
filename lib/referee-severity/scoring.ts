import {
  REFEREE_SEVERITY_MIN_MATCHES,
  type RefereeCardFixtureTotals,
  type RefereeSeverityStats
} from "@/lib/referee-severity/types";

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
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
    const current = byFixture.get(row.fixtureId) ?? { yellowCards: 0, redCards: 0 };
    current.yellowCards += row.yellowCards ?? 0;
    current.redCards += row.redCards ?? 0;
    byFixture.set(row.fixtureId, current);
  }
  return [...byFixture.values()];
}

/**
 * Media cartellini e severityScore = yellowAverage + (redAverage * 2).
 * Non è il profilo Match Radar: qui si ordinano le PARTITE, non gli arbitri.
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
  const severityScore = yellowAverage + redAverage * 2;

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

export function sortMatchesByRefereeSeverity<T extends { stats: RefereeSeverityStats | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aScore = a.stats?.sufficientSample ? a.stats.severityScore : -1;
    const bScore = b.stats?.sufficientSample ? b.stats.severityScore : -1;
    if (bScore !== aScore) return bScore - aScore;
    const aHasReferee = a.stats != null ? 1 : 0;
    const bHasReferee = b.stats != null ? 1 : 0;
    return bHasReferee - aHasReferee;
  });
}
