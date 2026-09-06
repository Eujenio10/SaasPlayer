import { mean } from "@/lib/fanta/rating";
import { fantaTeamsMatch } from "@/lib/fanta/quotazioni";
import type { FantaComputedPlayer } from "@/lib/fanta/types";

export function clampScore(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function scaleScore(value: number, low: number, high: number): number {
  if (high <= low) return 50;
  return clampScore(((value - low) / (high - low)) * 100);
}

export function teamIdsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export interface TeamMatchAgg {
  id: string;
  date: string;
  goals: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  goalsConceded: number | null;
}

export function teamMatchAggregates(catalog: FantaComputedPlayer[], teamId: string): TeamMatchAgg[] {
  const byFixture = new Map<string, TeamMatchAgg & { gkMinutes: number }>();
  for (const player of catalog) {
    if (!teamIdsEqual(player.teamId, teamId)) continue;
    for (const app of player.appearances) {
      if (app.minutes < 10 || !app.fixtureId) continue;
      const current = byFixture.get(app.fixtureId) ?? {
        id: app.fixtureId,
        date: app.date,
        goals: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        goalsConceded: null,
        gkMinutes: 0
      };
      current.goals += app.goals ?? 0;
      current.shots += app.shots ?? 0;
      current.shotsOnTarget += app.shotsOnTarget ?? 0;
      current.keyPasses += app.keyPasses ?? 0;
      if (app.date && app.date > current.date) current.date = app.date;
      if (
        player.roleGroup === "goalkeeper" &&
        app.goalsConceded != null &&
        app.minutes >= current.gkMinutes
      ) {
        current.goalsConceded = app.goalsConceded;
        current.gkMinutes = app.minutes;
      }
      byFixture.set(app.fixtureId, current);
    }
  }
  return [...byFixture.values()]
    .map((row) => ({
      id: row.id,
      date: row.date,
      goals: row.goals,
      shots: row.shots,
      shotsOnTarget: row.shotsOnTarget,
      keyPasses: row.keyPasses,
      goalsConceded: row.goalsConceded
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function teamFixtures(catalog: FantaComputedPlayer[], teamId: string): Array<{
  id: string;
  date: string;
  goals: number;
  shots: number;
}> {
  return teamMatchAggregates(catalog, teamId).map((row) => ({
    id: row.id,
    date: row.date,
    goals: row.goals,
    shots: row.shots
  }));
}

export function findOpponentTeam(
  catalog: FantaComputedPlayer[],
  opponentName: string | null
): FantaComputedPlayer | null {
  if (!opponentName) return null;
  return catalog.find((row) => fantaTeamsMatch(row.teamName, opponentName)) ?? null;
}

export function teamQualityScore(catalog: FantaComputedPlayer[], teamId: string): number | null {
  const recent = teamMatchAggregates(catalog, teamId).slice(-5);
  if (!recent.length) return null;
  const goals = mean(recent.map((row) => row.goals));
  const shots = mean(recent.map((row) => row.shots));
  if (goals == null && shots == null) return null;
  const goalScore = goals == null ? null : scaleScore(goals, 0.7, 2.4);
  const shotScore = shots == null ? null : scaleScore(shots, 7, 18);
  if (goalScore != null && shotScore != null) return clampScore(goalScore * 0.65 + shotScore * 0.35);
  return goalScore ?? shotScore;
}

export function teamFormScore(catalog: FantaComputedPlayer[], teamId: string): number | null {
  const fixtures = teamMatchAggregates(catalog, teamId);
  if (!fixtures.length) return null;
  if (fixtures.length === 1) {
    const goalScore = scaleScore(fixtures[0].goals, 0.6, 2.2);
    const shotScore = scaleScore(fixtures[0].shots, 7, 17);
    return clampScore(goalScore * 0.7 + shotScore * 0.3);
  }
  const half = Math.max(1, Math.floor(fixtures.length / 2));
  const recent = fixtures.slice(-half);
  const previous = fixtures.slice(0, -half);
  const gRecent = mean(recent.map((row) => row.goals));
  const gPrev = mean(previous.map((row) => row.goals));
  const sRecent = mean(recent.map((row) => row.shots));
  const sPrev = mean(previous.map((row) => row.shots));
  if (gRecent == null || gPrev == null) return null;
  return clampScore(50 + (gRecent - gPrev) * 18 + ((sRecent ?? 0) - (sPrev ?? 0)) * 1.6);
}

export function teamCleanSheetRate(catalog: FantaComputedPlayer[], teamId: string): number | null {
  const apps = catalog
    .filter((player) => teamIdsEqual(player.teamId, teamId) && player.roleGroup === "goalkeeper")
    .flatMap((player) =>
      player.appearances.filter((row) => row.goalsConceded != null && row.minutes >= 60).slice(-8)
    );
  if (!apps.length) return null;
  return apps.filter((row) => (row.goalsConceded ?? 1) === 0).length / apps.length;
}

export function teamGoalsConcededAvg(catalog: FantaComputedPlayer[], teamId: string, last = 5): number | null {
  const values = teamMatchAggregates(catalog, teamId)
    .slice(-last)
    .map((row) => row.goalsConceded)
    .filter((n): n is number => n != null);
  return mean(values);
}

/** Produzione delle squadre che hanno affrontato `opponentName`. */
export function matchesAgainstTeam(
  catalog: FantaComputedPlayer[],
  opponentName: string | null
): TeamMatchAgg[] {
  if (!opponentName) return [];
  const byFixture = new Map<string, TeamMatchAgg>();
  for (const player of catalog) {
    if (fantaTeamsMatch(player.teamName, opponentName)) continue;
    for (const app of player.appearances.slice(-12)) {
      if (!app.opponentName || !fantaTeamsMatch(app.opponentName, opponentName)) continue;
      if (app.minutes < 10 || !app.fixtureId) continue;
      const current = byFixture.get(app.fixtureId) ?? {
        id: app.fixtureId,
        date: app.date,
        goals: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        goalsConceded: null
      };
      current.goals += app.goals ?? 0;
      current.shots += app.shots ?? 0;
      current.shotsOnTarget += app.shotsOnTarget ?? 0;
      current.keyPasses += app.keyPasses ?? 0;
      if (app.date && app.date > current.date) current.date = app.date;
      byFixture.set(app.fixtureId, current);
    }
  }
  return [...byFixture.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function opponentLeakiness(catalog: FantaComputedPlayer[], opponentName: string | null): number | null {
  const rows = matchesAgainstTeam(catalog, opponentName).slice(-6);
  if (!rows.length) return null;
  const goals = mean(rows.map((row) => row.goals));
  const shots = mean(rows.map((row) => row.shots));
  if (goals == null) return null;
  const goalScore = scaleScore(goals, 0.6, 2.2);
  const shotScore = shots == null ? goalScore : scaleScore(shots, 7, 17);
  return clampScore(goalScore * 0.7 + shotScore * 0.3);
}

export function opponentConcededScore(catalog: FantaComputedPlayer[], opponentName: string | null): number | null {
  const opponent = findOpponentTeam(catalog, opponentName);
  if (!opponent) return null;
  const avg = teamGoalsConcededAvg(catalog, opponent.teamId, 5);
  return avg == null ? null : scaleScore(avg, 0.5, 2.1);
}

export interface OpponentDefenseProfile {
  goalsConcededAvg: number | null;
  cleanSheetRate: number | null;
  shotsConcededAvg: number | null;
  shotsOnTargetConcededAvg: number | null;
  chancesConcededAvg: number | null;
  leakiness: number | null;
  recentConcededAvg: number | null;
}

export function opponentDefenseProfile(
  catalog: FantaComputedPlayer[],
  opponentName: string | null
): OpponentDefenseProfile {
  const opponent = findOpponentTeam(catalog, opponentName);
  const vs = matchesAgainstTeam(catalog, opponentName).slice(-6);
  const recentVs = vs.slice(-3);
  return {
    goalsConcededAvg: opponent ? teamGoalsConcededAvg(catalog, opponent.teamId, 5) : mean(vs.map((row) => row.goals)),
    cleanSheetRate: opponent ? teamCleanSheetRate(catalog, opponent.teamId) : null,
    shotsConcededAvg: mean(vs.map((row) => row.shots)),
    shotsOnTargetConcededAvg: mean(vs.map((row) => row.shotsOnTarget)),
    chancesConcededAvg: mean(vs.map((row) => row.keyPasses)),
    leakiness: opponentLeakiness(catalog, opponentName),
    recentConcededAvg: mean(recentVs.map((row) => row.goals))
  };
}

export interface OpponentAttackProfile {
  goalsAvg: number | null;
  shotsAvg: number | null;
  shotsOnTargetAvg: number | null;
  chancesAvg: number | null;
  quality: number | null;
  form: number | null;
}

export function opponentAttackProfile(
  catalog: FantaComputedPlayer[],
  opponentName: string | null
): OpponentAttackProfile {
  const opponent = findOpponentTeam(catalog, opponentName);
  if (!opponent) {
    return {
      goalsAvg: null,
      shotsAvg: null,
      shotsOnTargetAvg: null,
      chancesAvg: null,
      quality: null,
      form: null
    };
  }
  const recent = teamMatchAggregates(catalog, opponent.teamId).slice(-5);
  return {
    goalsAvg: mean(recent.map((row) => row.goals)),
    shotsAvg: mean(recent.map((row) => row.shots)),
    shotsOnTargetAvg: mean(recent.map((row) => row.shotsOnTarget)),
    chancesAvg: mean(recent.map((row) => row.keyPasses)),
    quality: teamQualityScore(catalog, opponent.teamId),
    form: teamFormScore(catalog, opponent.teamId)
  };
}
