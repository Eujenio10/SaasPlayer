import { ENTITLEMENT_FLAGS } from "@/lib/entitlements/config";
import type { SubscriptionTier } from "@/lib/entitlements/types";

export type ContentAccessMode = "full" | "preview" | "locked";

export function resolveContentAccessMode(params: {
  tier: SubscriptionTier;
  matchUnlocked?: boolean;
  freePreviewEnabled?: boolean;
}): ContentAccessMode {
  if (params.tier === "pro") return "full";
  if (params.matchUnlocked) return "full";
  if (params.freePreviewEnabled !== false) return "preview";
  return "locked";
}

/** Limita le marcature Free alle N più difficili (già ordinate per score). */
export function redactDifficultMarkingsList<T>(params: {
  results: T[];
  tier: SubscriptionTier;
}): {
  results: T[];
  accessMode: ContentAccessMode;
  totalAvailable: number;
  freeLimit: number;
  lockedCount: number;
} {
  const freeLimit = ENTITLEMENT_FLAGS.freeDifficultMarkingsLimit;
  const totalAvailable = params.results.length;
  if (params.tier === "pro") {
    return {
      results: params.results,
      accessMode: "full",
      totalAvailable,
      freeLimit,
      lockedCount: 0
    };
  }
  const results = params.results.slice(0, freeLimit);
  return {
    results,
    accessMode: "preview",
    totalAvailable,
    freeLimit,
    lockedCount: Math.max(0, totalAvailable - results.length)
  };
}

/** Anteprima trend Free: un rising + un declining (o primi N). */
export function redactTrendsList<T>(params: {
  results: T[];
  tier: SubscriptionTier;
}): {
  results: T[];
  accessMode: ContentAccessMode;
  totalAvailable: number;
  freeLimit: number;
  lockedCount: number;
} {
  const freeLimit = ENTITLEMENT_FLAGS.freeTrendPreviewLimit;
  const totalAvailable = params.results.length;
  if (params.tier === "pro") {
    return {
      results: params.results,
      accessMode: "full",
      totalAvailable,
      freeLimit,
      lockedCount: 0
    };
  }

  const levelOf = (row: T): string | undefined => {
    if (!row || typeof row !== "object") return undefined;
    const level = (row as { trendLevel?: unknown }).trendLevel;
    return typeof level === "string" ? level : undefined;
  };

  const isGrowth = (level: string | undefined) =>
    Boolean(level && (level.includes("growth") || level === "positive_trend" || level === "increasing"));
  const isHidden = (level: string | undefined) => level === "hidden";

  const rising = params.results.find((r) => isGrowth(levelOf(r)));
  const declining = params.results.find((r) => isHidden(levelOf(r)));

  const picked: T[] = [];
  if (rising) picked.push(rising);
  if (declining && declining !== rising) picked.push(declining);
  while (picked.length < freeLimit && picked.length < params.results.length) {
    const next = params.results.find((r) => !picked.includes(r));
    if (!next) break;
    picked.push(next);
  }

  return {
    results: picked,
    accessMode: "preview",
    totalAvailable,
    freeLimit,
    lockedCount: Math.max(0, totalAvailable - picked.length)
  };
}

/** Simulazione Free: solo riepilogo sintetico. */
export function redactSimulationDetail(params: {
  simulation: unknown;
  tier: SubscriptionTier;
  matchUnlocked: boolean;
}): { simulation: unknown; accessMode: ContentAccessMode } {
  if (!params.simulation) {
    return {
      simulation: null,
      accessMode: params.tier === "pro" || params.matchUnlocked ? "full" : "preview"
    };
  }
  if (params.tier === "pro" || params.matchUnlocked) {
    return { simulation: params.simulation, accessMode: "full" };
  }
  if (!ENTITLEMENT_FLAGS.freeSimulationPreviewEnabled) {
    return { simulation: null, accessMode: "locked" };
  }

  const src = params.simulation as MatchSimulationResultLike;
  const homeGoals = src.homeTeam?.goals?.mean ?? null;
  const awayGoals = src.awayTeam?.goals?.mean ?? null;
  const expectedGoals =
    homeGoals != null && awayGoals != null ? Number((homeGoals + awayGoals).toFixed(2)) : null;

  const preview: MatchSimulationResultLike = {
    id: src.id,
    fixtureId: src.fixtureId,
    simulationsCount: src.simulationsCount,
    modelVersion: src.modelVersion,
    generatedAt: src.generatedAt,
    reliabilityScore: src.reliabilityScore,
    reliabilityLabel: src.reliabilityLabel,
    homeTeam: src.homeTeam
      ? {
          teamId: src.homeTeam.teamId,
          teamName: src.homeTeam.teamName,
          goals: src.homeTeam.goals,
          shots: src.homeTeam.shots
            ? { mean: (src.homeTeam.shots as { mean?: number }).mean }
            : undefined
        }
      : src.homeTeam,
    awayTeam: src.awayTeam
      ? {
          teamId: src.awayTeam.teamId,
          teamName: src.awayTeam.teamName,
          goals: src.awayTeam.goals
        }
      : src.awayTeam,
    mostLikelyScores: Array.isArray(src.mostLikelyScores) ? src.mostLikelyScores.slice(0, 3) : [],
    scoreDistribution: [],
    insights: [],
    dataWarnings: ["preview_only"],
    previewOnly: true,
    expectedGoalsSummary: expectedGoals,
    extraIndicator:
      src.homeTeam?.shots && typeof (src.homeTeam.shots as { mean?: number }).mean === "number"
        ? (src.homeTeam.shots as { mean: number }).mean
        : null
  };

  return { simulation: preview, accessMode: "preview" };
}

type MatchSimulationResultLike = {
  id?: string;
  fixtureId?: string;
  simulationsCount?: number;
  modelVersion?: string;
  generatedAt?: string;
  reliabilityScore?: number;
  reliabilityLabel?: string;
  homeTeam?: {
    teamId?: number | string;
    teamName?: string;
    goals?: { mean?: number };
    shots?: { mean?: number };
    [key: string]: unknown;
  };
  awayTeam?: {
    teamId?: number | string;
    teamName?: string;
    goals?: { mean?: number };
    [key: string]: unknown;
  };
  mostLikelyScores?: unknown[];
  scoreDistribution?: unknown[];
  insights?: unknown[];
  dataWarnings?: string[];
  previewOnly?: boolean;
  expectedGoalsSummary?: number | null;
  extraIndicator?: number | null;
  [key: string]: unknown;
};

