import { clamp } from "@/lib/match-simulator/math";
import type { ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import type { TeamSimulationProfile } from "@/lib/match-simulator/types";

export interface MatchBudgetConfig {
  totalFactor: number;
  maxTeamFactor: number;
  minTeamFactor: number;
}

export const MATCH_BUDGET = {
  goals: { totalFactor: 0.86, maxTeamFactor: 1.05, minTeamFactor: 0.62 },
  shots: { totalFactor: 0.9, maxTeamFactor: 1.06, minTeamFactor: 0.72 },
  fouls: { totalFactor: 0.93, maxTeamFactor: 1.07, minTeamFactor: 0.78 },
  corners: { totalFactor: 0.91, maxTeamFactor: 1.08, minTeamFactor: 0.7 },
  offsides: { totalFactor: 0.9, maxTeamFactor: 1.1, minTeamFactor: 0.65 }
} as const satisfies Record<string, MatchBudgetConfig>;

/** Baseline attesa = media tra produzione propria e concessioni dell'avversario. */
function goalBaseline(home: TeamSimulationProfile, away: TeamSimulationProfile, side: "home" | "away"): number {
  if (side === "home") {
    return (home.season.goalsFor + away.season.goalsAgainst) / 2;
  }
  return (away.season.goalsFor + home.season.goalsAgainst) / 2;
}

function shotBaseline(home: TeamSimulationProfile, away: TeamSimulationProfile, side: "home" | "away"): number {
  if (side === "home") {
    return (home.season.shotsFor + away.season.shotsAgainst) / 2;
  }
  return (away.season.shotsFor + home.season.shotsAgainst) / 2;
}

function foulBaseline(home: TeamSimulationProfile, away: TeamSimulationProfile, side: "home" | "away"): number {
  if (side === "home") {
    return (home.season.foulsCommitted + (away.season.foulsSuffered ?? away.season.foulsCommitted)) / 2;
  }
  return (away.season.foulsCommitted + (home.season.foulsSuffered ?? home.season.foulsCommitted)) / 2;
}

function cornerBaseline(home: TeamSimulationProfile, away: TeamSimulationProfile, side: "home" | "away"): number {
  if (side === "home") {
    return (home.season.cornersFor + away.season.cornersAgainst) / 2;
  }
  return (away.season.cornersFor + home.season.cornersAgainst) / 2;
}

function offsideBaseline(home: TeamSimulationProfile, away: TeamSimulationProfile, side: "home" | "away"): number {
  if (side === "home") {
    return (home.season.offsidesFor + away.season.offsidesAgainst) / 2;
  }
  return (away.season.offsidesFor + home.season.offsidesAgainst) / 2;
}

export function normalizePairToMatchBudget(params: {
  homeValue: number;
  awayValue: number;
  homeSeason: number;
  awaySeason: number;
  config: MatchBudgetConfig;
}): { home: number; away: number } {
  const budget = Math.max(
    0.01,
    (params.homeSeason + params.awaySeason) * params.config.totalFactor
  );

  let home = Math.max(0, params.homeValue);
  let away = Math.max(0, params.awayValue);

  const total = home + away;
  if (total > budget && total > 0) {
    const scale = budget / total;
    home *= scale;
    away *= scale;
  }

  home = clamp(
    home,
    params.homeSeason * params.config.minTeamFactor,
    params.homeSeason * params.config.maxTeamFactor
  );
  away = clamp(
    away,
    params.awaySeason * params.config.minTeamFactor,
    params.awaySeason * params.config.maxTeamFactor
  );

  const recomputedTotal = home + away;
  if (recomputedTotal > budget && recomputedTotal > 0) {
    const scale = budget / recomputedTotal;
    home *= scale;
    away *= scale;
  }

  return { home, away };
}

export function applyMatchBudgetToExpected(
  expected: ExpectedMatchMetrics,
  home: TeamSimulationProfile,
  away: TeamSimulationProfile
): ExpectedMatchMetrics {
  const goals = normalizePairToMatchBudget({
    homeValue: expected.homeGoals,
    awayValue: expected.awayGoals,
    homeSeason: goalBaseline(home, away, "home"),
    awaySeason: goalBaseline(home, away, "away"),
    config: MATCH_BUDGET.goals
  });

  const shots = normalizePairToMatchBudget({
    homeValue: expected.homeShots,
    awayValue: expected.awayShots,
    homeSeason: shotBaseline(home, away, "home"),
    awaySeason: shotBaseline(home, away, "away"),
    config: MATCH_BUDGET.shots
  });

  const fouls = normalizePairToMatchBudget({
    homeValue: expected.homeFouls,
    awayValue: expected.awayFouls,
    homeSeason: foulBaseline(home, away, "home"),
    awaySeason: foulBaseline(home, away, "away"),
    config: MATCH_BUDGET.fouls
  });

  const corners = normalizePairToMatchBudget({
    homeValue: expected.homeCorners,
    awayValue: expected.awayCorners,
    homeSeason: cornerBaseline(home, away, "home"),
    awaySeason: cornerBaseline(home, away, "away"),
    config: MATCH_BUDGET.corners
  });

  const offsides = normalizePairToMatchBudget({
    homeValue: expected.homeOffsides,
    awayValue: expected.awayOffsides,
    homeSeason: offsideBaseline(home, away, "home"),
    awaySeason: offsideBaseline(home, away, "away"),
    config: MATCH_BUDGET.offsides
  });

  return {
    ...expected,
    homeGoals: goals.home,
    awayGoals: goals.away,
    homeShots: shots.home,
    awayShots: shots.away,
    homeFouls: fouls.home,
    awayFouls: fouls.away,
    homeCorners: corners.home,
    awayCorners: corners.away,
    homeOffsides: offsides.home,
    awayOffsides: offsides.away,
    homeShotsOnTargetExpected: shots.home * expected.homeShotAccuracy,
    awayShotsOnTargetExpected: shots.away * expected.awayShotAccuracy,
    homeSavesExpected: Math.max(0, shots.away * expected.awayShotAccuracy - goals.away),
    awaySavesExpected: Math.max(0, shots.home * expected.homeShotAccuracy - goals.home)
  };
}
