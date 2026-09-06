import type { FantaAppearance, FantaRoleGroup, FantaScoreBreakdown, FantaTrendDirection } from "@/lib/fanta/types";

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function avg(values: number[]): number | null {
  return mean(values);
}

export function ratingToScore(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return null;
  return clamp(rating * 10);
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function lastPlayedAppearances(appearances: FantaAppearance[], n: number): FantaAppearance[] {
  return appearances.filter((row) => row.minutes >= 15).slice(-n);
}

export function lastNRatings(appearances: FantaAppearance[], n: number): number[] {
  return appearances
    .slice(-n)
    .map((row) => row.ratingApi)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
}

export function shortTrendRatings(appearances: FantaAppearance[]): number[] {
  return lastPlayedAppearances(appearances, 3)
    .map((row) => row.ratingApi)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
}

export function shortTrendDelta(appearances: FantaAppearance[]): number | null {
  const ratings = shortTrendRatings(appearances);
  if (ratings.length < 3) return null;
  return Math.round((ratings[ratings.length - 1] - ratings[0]) * 10) / 10;
}

export function computeTrend(appearances: FantaAppearance[]): FantaTrendDirection {
  const ratings = shortTrendRatings(appearances);
  if (ratings.length < 3) return "stable";
  const delta = ratings[ratings.length - 1] - ratings[0];
  if (delta >= 0.2) return "up";
  if (delta <= -0.2) return "down";
  return "stable";
}

function scale(value: number, low: number, high: number): number {
  if (high <= low) return 50;
  return clamp(((value - low) / (high - low)) * 100);
}

function per90(total: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (total * 90) / minutes;
}

export function computeProductionScore(
  appearances: FantaAppearance[],
  role: FantaRoleGroup
): number | null {
  const sample = appearances.slice(-10);
  if (!sample.length) return null;
  const minutes = sample.reduce((sum, row) => sum + row.minutes, 0);
  if (minutes < 90) return null;
  const goals = sample.reduce((sum, row) => sum + (row.goals ?? 0), 0);
  const assists = sample.reduce((sum, row) => sum + (row.assists ?? 0), 0);
  const shots = sample.reduce((sum, row) => sum + (row.shots ?? 0), 0);
  const sot = sample.reduce((sum, row) => sum + (row.shotsOnTarget ?? 0), 0);
  const keyPasses = sample.reduce((sum, row) => sum + (row.keyPasses ?? 0), 0);
  const dribbles = sample.reduce((sum, row) => sum + (row.dribbles ?? 0), 0);
  const saves = sample.reduce((sum, row) => sum + (row.saves ?? 0), 0);

  const g90 = per90(goals, minutes);
  const a90 = per90(assists, minutes);
  const s90 = per90(shots, minutes);
  const sot90 = per90(sot, minutes);
  const kp90 = per90(keyPasses, minutes);
  const d90 = per90(dribbles, minutes);

  if (role === "goalkeeper") {
    const minutesScore = scale(minutes / sample.length, 45, 90);
    const savesScore = scale(per90(saves, minutes), 1.5, 5.5);
    const concededSample = sample.filter((row) => row.goalsConceded != null);
    const concededMinutes = concededSample.reduce((sum, row) => sum + row.minutes, 0);
    const conceded = concededSample.reduce((sum, row) => sum + (row.goalsConceded ?? 0), 0);
    const cleanSheets = concededSample.filter(
      (row) => row.minutes >= 60 && (row.goalsConceded ?? 1) === 0
    ).length;
    const parts: Array<{ w: number; v: number }> = [
      { w: 0.28, v: minutesScore },
      { w: 0.36, v: savesScore }
    ];
    if (concededMinutes >= 90) {
      parts.push({ w: 0.22, v: scale(1.7 - per90(conceded, concededMinutes), 0, 1.7) });
      parts.push({ w: 0.14, v: scale(cleanSheets / Math.max(1, concededSample.length), 0.1, 0.5) });
    }
    const weight = parts.reduce((sum, row) => sum + row.w, 0);
    return clamp(parts.reduce((sum, row) => sum + row.v * row.w, 0) / weight);
  }
  if (role === "defender") {
    return clamp(
      scale(d90, 0, 2.2) * 0.18 +
        scale(kp90, 0, 1.4) * 0.16 +
        scale(a90, 0, 0.25) * 0.14 +
        scale(s90, 0.2, 2.2) * 0.12 +
        scale(g90, 0, 0.28) * 0.1 +
        40
    );
  }
  if (role === "midfielder") {
    return clamp(
      scale(kp90, 0.2, 2.4) * 0.28 +
        scale(a90, 0, 0.45) * 0.22 +
        scale(d90, 0.2, 3.2) * 0.18 +
        scale(s90, 0.4, 3.2) * 0.16 +
        scale(g90, 0, 0.4) * 0.16
    );
  }
  return clamp(
    scale(g90, 0.1, 0.85) * 0.28 +
      scale(s90, 1.2, 5.2) * 0.18 +
      scale(sot90, 0.4, 2.4) * 0.16 +
      scale(a90, 0, 0.5) * 0.14 +
      scale(kp90, 0.2, 2.2) * 0.12 +
      scale(d90, 0.3, 3.5) * 0.12
  );
}

export function computeContributionScore(
  appearances: FantaAppearance[],
  role: FantaRoleGroup
): { score: number | null; perGame: number | null } {
  const sample = appearances.filter((row) => row.minutes >= 15).slice(-8);
  if (sample.length < 2) return { score: null, perGame: null };

  if (role === "goalkeeper") {
    const concededSample = sample.filter((row) => row.goalsConceded != null);
    const savesPerGame = sample.reduce((sum, row) => sum + (row.saves ?? 0), 0) / sample.length;
    const concededPerGame = concededSample.length
      ? concededSample.reduce((sum, row) => sum + (row.goalsConceded ?? 0), 0) / concededSample.length
      : null;
    const parts: Array<{ w: number; v: number }> = [{ w: 0.55, v: scale(savesPerGame, 1.2, 5) }];
    if (concededPerGame != null) {
      parts.push({ w: 0.45, v: scale(1.8 - concededPerGame, 0, 1.8) });
    }
    const weight = parts.reduce((sum, row) => sum + row.w, 0);
    return {
      score: clamp(parts.reduce((sum, row) => sum + row.v * row.w, 0) / weight),
      perGame: concededPerGame
    };
  }

  const perGame =
    sample.reduce((sum, row) => sum + (row.goals ?? 0) + (row.assists ?? 0), 0) / sample.length;
  const high = role === "forward" ? 1.05 : role === "midfielder" ? 0.7 : 0.4;
  return { score: scale(perGame, 0, high), perGame };
}

export function minutesProfile(appearances: FantaAppearance[]): {
  avgMinutes: number | null;
  presencePct: number | null;
  startPct: number | null;
} {
  const played = appearances.filter((row) => row.minutes >= 1);
  const sample = (played.length ? played : appearances).slice(-8);
  if (!sample.length) return { avgMinutes: null, presencePct: null, startPct: null };
  const withMinutes = sample.filter((row) => row.minutes >= 15).length;
  return {
    avgMinutes: sample.reduce((sum, row) => sum + row.minutes, 0) / sample.length,
    presencePct: (withMinutes / sample.length) * 100,
    startPct: (sample.filter((row) => row.starter).length / sample.length) * 100
  };
}

export function computeConsistencyScore(appearances: FantaAppearance[]): number | null {
  const played = appearances.filter((row) => row.minutes >= 1);
  const sample = (played.length ? played : appearances).slice(-8);
  if (!sample.length) return null;
  const withMinutes = sample.filter((row) => row.minutes >= 15).length;
  const presence = withMinutes / sample.length;
  const avgMinutes = sample.reduce((sum, row) => sum + row.minutes, 0) / sample.length;
  const startRate = sample.filter((row) => row.starter).length / sample.length;
  return clamp(presence * 45 + scale(avgMinutes, 25, 90) * 0.35 + startRate * 20);
}

export function computePerformanceScore(appearances: FantaAppearance[]): number | null {
  const last = appearances.at(-1)?.ratingApi ?? null;
  const last5 = avg(lastNRatings(appearances, 5));
  const last10 = avg(lastNRatings(appearances, 10));
  const parts: Array<{ w: number; v: number }> = [];
  const lastScore = ratingToScore(last);
  const s5 = ratingToScore(last5);
  const s10 = ratingToScore(last10);
  if (lastScore != null) parts.push({ w: 0.4, v: lastScore });
  if (s5 != null) parts.push({ w: 0.35, v: s5 });
  if (s10 != null) parts.push({ w: 0.25, v: s10 });
  if (!parts.length) return null;
  const weight = parts.reduce((sum, p) => sum + p.w, 0);
  return clamp(parts.reduce((sum, p) => sum + p.v * p.w, 0) / weight);
}

export function combineFantaRating(params: {
  performance: number | null;
  production: number | null;
  consistency: number | null;
  matchup: number | null;
}): FantaScoreBreakdown {
  const weights: Array<{ key: keyof Omit<FantaScoreBreakdown, "pitchbrainFantaRating" | "usedFallback">; w: number; v: number | null }> =
    [
      { key: "performance", w: 0.4, v: params.performance },
      { key: "production", w: 0.25, v: params.production },
      { key: "consistency", w: 0.15, v: params.consistency },
      { key: "matchup", w: 0.2, v: params.matchup }
    ];
  const available = weights.filter((row) => row.v != null);
  const usedFallback = params.performance == null;
  if (!available.length) {
    return {
      performance: params.performance,
      production: params.production,
      consistency: params.consistency,
      matchup: params.matchup,
      pitchbrainFantaRating: 50,
      usedFallback: true
    };
  }
  const totalW = available.reduce((sum, row) => sum + row.w, 0);
  const rating = available.reduce((sum, row) => sum + (row.v as number) * (row.w / totalW), 0);
  return {
    performance: params.performance,
    production: params.production,
    consistency: params.consistency,
    matchup: params.matchup,
    pitchbrainFantaRating: Math.round(clamp(rating)),
    usedFallback
  };
}
