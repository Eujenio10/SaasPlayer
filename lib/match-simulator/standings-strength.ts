import { POSSESSION_CLAMP, STANDINGS_STRENGTH } from "@/lib/match-simulator/constants";
import type { ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import { clamp } from "@/lib/match-simulator/math";
import type {
  StandingsAdjustment,
  StandingsAdjustmentSource,
  StandingsTeamSnapshot
} from "@/lib/match-simulator/types";

export interface StandingsTableRow {
  teamId: string;
  position: number | null;
  matches: number;
  points: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
}

/** Classifica ricostruita da partite già giocate (niente leak futuro). */
export function reconstructStandingsFromMatchStats(
  rows: Array<{
    fixtureId: string;
    teamId: string;
    goalsFor: number;
    goalsAgainst: number;
  }>
): StandingsTableRow[] {
  const seen = new Set<string>();
  const acc = new Map<
    string,
    { matches: number; points: number; goalsFor: number; goalsAgainst: number }
  >();

  for (const row of rows) {
    const key = `${row.teamId}:${row.fixtureId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = acc.get(row.teamId) ?? {
      matches: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0
    };
    current.matches += 1;
    current.goalsFor += row.goalsFor;
    current.goalsAgainst += row.goalsAgainst;
    if (row.goalsFor > row.goalsAgainst) current.points += 3;
    else if (row.goalsFor === row.goalsAgainst) current.points += 1;
    acc.set(row.teamId, current);
  }

  return [...acc.entries()]
    .sort((a, b) => {
      if (b[1].points !== a[1].points) return b[1].points - a[1].points;
      const gdA = a[1].goalsFor - a[1].goalsAgainst;
      const gdB = b[1].goalsFor - b[1].goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b[1].goalsFor - a[1].goalsFor;
    })
    .map(([teamId, stats], index) => ({
      teamId,
      position: index + 1,
      matches: stats.matches,
      points: stats.points,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst
    }));
}

function finiteNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function minMaxNormalize(value: number, leagueValues: number[]): number {
  const finite = leagueValues.filter((item) => Number.isFinite(item));
  if (!Number.isFinite(value) || finite.length === 0) return 0.5;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max <= min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

export function rankStrength(position: number, teamsInLeague: number): number {
  if (!Number.isFinite(position) || position < 1 || teamsInLeague <= 1) return 0.5;
  return clamp(1 - (position - 1) / (teamsInLeague - 1), 0, 1);
}

export function seasonProgressWeight(matchesPlayed: number): number {
  const played = Math.max(0, matchesPlayed);
  const { progress } = STANDINGS_STRENGTH;
  if (played <= progress.veryEarlyMaxMatches) return progress.veryEarly;
  if (played <= progress.earlyMaxMatches) return progress.early;
  if (played <= progress.midMaxMatches) return progress.mid;
  return progress.full;
}

export function teamPpg(row: StandingsTableRow): number | null {
  if (row.points == null || row.matches <= 0) return null;
  return row.points / row.matches;
}

export function teamGdPerGame(row: StandingsTableRow): number | null {
  if (row.goalsFor == null || row.goalsAgainst == null || row.matches <= 0) return null;
  return (row.goalsFor - row.goalsAgainst) / row.matches;
}

export function compositeStandingsStrength(params: {
  row: StandingsTableRow;
  league: StandingsTableRow[];
}): number | null {
  const { row, league } = params;
  if (league.length === 0) return null;

  const teamsInLeague = Math.max(
    league.length,
    ...league.map((item) => item.position ?? 0)
  );
  const ppg = teamPpg(row);
  const gdPerGame = teamGdPerGame(row);
  const hasRank = row.position != null && row.position > 0 && teamsInLeague > 1;

  const ppgStrength =
    ppg != null ? minMaxNormalize(ppg, finiteNumbers(league.map(teamPpg))) : null;
  const gdStrength =
    gdPerGame != null
      ? minMaxNormalize(gdPerGame, finiteNumbers(league.map(teamGdPerGame)))
      : null;
  const rStrength = hasRank ? rankStrength(row.position as number, teamsInLeague) : null;

  if (ppgStrength != null && gdStrength != null && rStrength != null) {
    return (
      STANDINGS_STRENGTH.ppgWeight * ppgStrength +
      STANDINGS_STRENGTH.gdWeight * gdStrength +
      STANDINGS_STRENGTH.rankWeight * rStrength
    );
  }
  if (ppgStrength == null && gdStrength != null && rStrength != null) {
    return (
      STANDINGS_STRENGTH.fallbackGdWeight * gdStrength +
      STANDINGS_STRENGTH.fallbackRankWeight * rStrength
    );
  }
  if (gdStrength == null && rStrength != null) {
    return rStrength;
  }
  if (ppgStrength != null && gdStrength != null) {
    return 0.65 * ppgStrength + 0.35 * gdStrength;
  }
  return ppgStrength ?? gdStrength ?? rStrength;
}

export function attackModifier(params: {
  ownStrength: number;
  opponentStrength: number;
  matchesPlayed: number;
  k?: number;
}): number {
  const progress = seasonProgressWeight(params.matchesPlayed);
  const k = params.k ?? STANDINGS_STRENGTH.k;
  const strengthDiff = params.ownStrength - params.opponentStrength;
  const effectiveK = k * progress;
  return clamp(
    1 + effectiveK * strengthDiff,
    1 - STANDINGS_STRENGTH.maxModifier,
    1 + STANDINGS_STRENGTH.maxModifier
  );
}

function emptySnapshot(teamId: string): StandingsTeamSnapshot {
  return {
    teamId,
    position: null,
    matches: 0,
    points: null,
    goalsFor: null,
    goalsAgainst: null,
    ppg: null,
    gdPerGame: null,
    strength: null
  };
}

function snapshotFromRow(
  row: StandingsTableRow | undefined,
  teamId: string,
  league: StandingsTableRow[]
): StandingsTeamSnapshot {
  if (!row) return emptySnapshot(teamId);
  return {
    teamId: row.teamId,
    position: row.position,
    matches: row.matches,
    points: row.points,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    ppg: teamPpg(row),
    gdPerGame: teamGdPerGame(row),
    strength: compositeStandingsStrength({ row, league })
  };
}

export function neutralStandingsAdjustment(
  homeTeamId: string,
  awayTeamId: string
): StandingsAdjustment {
  return {
    source: "none",
    home: emptySnapshot(homeTeamId),
    away: emptySnapshot(awayTeamId),
    strengthDiff: 0,
    modifierHome: 1,
    modifierAway: 1,
    seasonProgressWeight: 1,
    effectiveK: 0,
    k: STANDINGS_STRENGTH.k
  };
}

export function buildStandingsAdjustment(params: {
  table: StandingsTableRow[];
  homeTeamId: string;
  awayTeamId: string;
  source: Exclude<StandingsAdjustmentSource, "none">;
  k?: number;
}): StandingsAdjustment {
  const k = params.k ?? STANDINGS_STRENGTH.k;
  if (params.table.length === 0) {
    return { ...neutralStandingsAdjustment(params.homeTeamId, params.awayTeamId), k };
  }

  const homeRow = params.table.find((row) => row.teamId === params.homeTeamId);
  const awayRow = params.table.find((row) => row.teamId === params.awayTeamId);
  if (!homeRow && !awayRow) {
    return { ...neutralStandingsAdjustment(params.homeTeamId, params.awayTeamId), k };
  }

  const home = snapshotFromRow(homeRow, params.homeTeamId, params.table);
  const away = snapshotFromRow(awayRow, params.awayTeamId, params.table);
  const homeStrength = home.strength ?? 0.5;
  const awayStrength = away.strength ?? 0.5;
  const matchesPlayed = Math.min(
    homeRow?.matches ?? 0,
    awayRow?.matches ?? 0
  );
  const progress = seasonProgressWeight(matchesPlayed);
  const strengthDiff = homeStrength - awayStrength;

  return {
    source: params.source,
    home: { ...home, strength: home.strength ?? 0.5 },
    away: { ...away, strength: away.strength ?? 0.5 },
    strengthDiff,
    modifierHome: attackModifier({
      ownStrength: homeStrength,
      opponentStrength: awayStrength,
      matchesPlayed,
      k
    }),
    modifierAway: attackModifier({
      ownStrength: awayStrength,
      opponentStrength: homeStrength,
      matchesPlayed,
      k
    }),
    seasonProgressWeight: progress,
    effectiveK: k * progress,
    k
  };
}

export function applyStandingsToExpected(
  expected: ExpectedMatchMetrics,
  adjustment: StandingsAdjustment
): ExpectedMatchMetrics {
  if (adjustment.source === "none") return expected;

  const homeGoals = expected.homeGoals * adjustment.modifierHome;
  const awayGoals = expected.awayGoals * adjustment.modifierAway;
  const homeShots = expected.homeShots * adjustment.modifierHome;
  const awayShots = expected.awayShots * adjustment.modifierAway;
  const homeCorners = expected.homeCorners * adjustment.modifierHome;
  const awayCorners = expected.awayCorners * adjustment.modifierAway;
  const homeOffsides = expected.homeOffsides * adjustment.modifierHome;
  const awayOffsides = expected.awayOffsides * adjustment.modifierAway;
  const homeShotsOnTargetExpected = homeShots * expected.homeShotAccuracy;
  const awayShotsOnTargetExpected = awayShots * expected.awayShotAccuracy;

  const possessionShift = clamp(
    adjustment.strengthDiff *
      STANDINGS_STRENGTH.possessionShift *
      adjustment.seasonProgressWeight,
    -STANDINGS_STRENGTH.possessionShift,
    STANDINGS_STRENGTH.possessionShift
  );

  return {
    ...expected,
    homeGoals,
    awayGoals,
    homeShots,
    awayShots,
    homeCorners,
    awayCorners,
    homeOffsides,
    awayOffsides,
    homeShotsOnTargetExpected,
    awayShotsOnTargetExpected,
    homeSavesExpected: Math.max(0, awayShotsOnTargetExpected - awayGoals),
    awaySavesExpected: Math.max(0, homeShotsOnTargetExpected - homeGoals),
    homePossession: clamp(
      expected.homePossession + possessionShift,
      POSSESSION_CLAMP.min,
      POSSESSION_CLAMP.max
    )
  };
}
