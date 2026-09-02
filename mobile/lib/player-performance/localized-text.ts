import type { PlayerPerformanceBadgeId, PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import type { ConsistencyClassification, FinishingFormStatus } from "@/lib/player-performance/advanced-types";
import type { PlayerPerformanceRoleGroup, PlayerTrendStatus } from "@/lib/player-performance/types";
import { PLAYER_PERFORMANCE_TEXT } from "@/lib/player-performance/text";
import { t } from "@/lib/i18n";

export {
  formatIndex,
  formatPercent,
  formatTrendPercent,
  sparklineText,
  trendArrow
} from "@/lib/player-performance/text";

export function mainTabLabel(tab: PlayerPerformanceMainTab): string {
  const map: Record<PlayerPerformanceMainTab, string> = {
    overview: t("pp.tabOverview"),
    shooting: t("pp.tabShooting"),
    creation: t("pp.tabCreation"),
    trends: t("pp.tabTrends")
  };
  return map[tab];
}

export function categoryTabLabel(id: "dangerous" | "rising" | "declining"): string {
  if (id === "rising") return t("pp.rising");
  if (id === "declining") return t("pp.declining");
  return t("pp.dangerous");
}

export function roleGroupLabel(role: PlayerPerformanceRoleGroup): string {
  if (role === "goalkeeper") return t("pp.roleGk");
  if (role === "defender") return t("pp.roleDef");
  if (role === "forward") return t("pp.roleAtt");
  return t("pp.roleMid");
}

export function badgeLabel(badge: PlayerPerformanceBadgeId): string {
  const map: Record<PlayerPerformanceBadgeId, string> = {
    high_shot_volume: t("pp.badgeHighShotVolume"),
    high_shot_accuracy: t("pp.badgeHighShotAccuracy"),
    main_creator: t("pp.badgeMainCreator"),
    one_vs_one_specialist: t("pp.badgeOneVsOne"),
    steady_growth: t("pp.badgeSteadyGrowth"),
    isolated_peak: t("pp.badgeIsolatedPeak"),
    finishing_above_average: t("pp.badgeFinishingAbove"),
    high_production_low_goals: t("pp.badgeHighProdLowGoals"),
    goals_without_shot_growth: t("pp.badgeGoalsNoShotGrowth"),
    stable_starter: t("pp.badgeStableStarter"),
    bench_impact: t("pp.badgeBenchImpact"),
    more_offensive_role: t("pp.badgeMoreOffensive"),
    favorable_matchup: t("pp.badgeFavorable"),
    limited_sample: t("pp.badgeLimitedSample"),
    partial_data: t("pp.badgePartialData")
  };
  return map[badge] ?? badge;
}

export function consistencyLabel(classification: ConsistencyClassification | null): string {
  if (!classification) return "—";
  const map: Record<ConsistencyClassification, string> = {
    very_consistent: t("pp.consVery"),
    consistent: t("pp.cons"),
    variable: t("pp.consVar"),
    very_variable: t("pp.consVeryVar")
  };
  return map[classification];
}

export function finishingFormLabel(status: FinishingFormStatus): string {
  const map: Record<FinishingFormStatus, string> = {
    production_growth: t("pp.finishingProductionGrowth"),
    finishing_growth: t("pp.finishingGrowth"),
    production_high_finishing_low: t("pp.finishingHighLow"),
    goals_growth_without_shot_growth: t("pp.finishingGoalsNoShots"),
    finishing_above_recent_average: t("pp.finishingAboveAvg"),
    finishing_decline: t("pp.finishingDecline"),
    neutral: t("pp.finishingNeutral")
  };
  return map[status] ?? status;
}

export function roleChangeLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  const map: Record<string, string> = {
    more_offensive_role: t("pp.roleMoreOffensive"),
    frequent_substitute: t("pp.roleSub"),
    recent_position_shift: t("pp.roleShift")
  };
  return map[key] ?? null;
}

export function trendStatusLabel(status: PlayerTrendStatus | null): string {
  switch (status) {
    case "strong_growth":
      return t("pp.trendStrongGrowth");
    case "growth":
      return t("pp.trendGrowth");
    case "stable":
      return t("pp.trendStable");
    case "decline":
      return t("pp.trendDecline");
    case "strong_decline":
      return t("pp.trendStrongDecline");
    default:
      return "—";
  }
}

export function reliabilityLabel(level: "high" | "medium" | "limited"): string {
  if (level === "high") return t("pp.relHigh");
  if (level === "medium") return t("pp.relMedium");
  return t("pp.relLimited");
}

export function reliabilityDetail(appearances: number, minutes: number): string {
  return t("pp.relDetail", { appearances, minutes });
}

export function localizePpWarning(warning: string): string {
  const map: Record<string, string> = {
    [PLAYER_PERFORMANCE_TEXT.insufficientData]: t("pp.insufficientData"),
    [PLAYER_PERFORMANCE_TEXT.insufficientMatches]: t("pp.insufficientMatches"),
    [PLAYER_PERFORMANCE_TEXT.noCurrentSeasonMatches]: t("pp.noCurrentSeason"),
    [PLAYER_PERFORMANCE_TEXT.limitedCoverage]: t("pp.limitedCoverage"),
    [PLAYER_PERFORMANCE_TEXT.rateLimited]: t("pp.rateLimited")
  };
  return map[warning] ?? warning;
}

export function localizePpInsight(insight: string | null | undefined): string | null {
  if (!insight) return null;
  const shotVolume = insight.match(
    /^Ha aumentato il volume di tiro in (.+) delle ultime presenze analizzate\.$/
  );
  if (shotVolume) return t("pp.insightShotVolume", { matches: shotVolume[1]! });
  const lowAcc = insight.match(
    /^Produce molti tiri, ma soltanto il (.+)% raggiunge lo specchio\.$/
  );
  if (lowAcc) return t("pp.insightLowAccuracy", { pct: lowAcc[1]! });
  const starter = insight.match(
    /^È stato titolare in (.+) delle ultime partite e ha aumentato i minuti medi\.$/
  );
  if (starter) return t("pp.insightStarter", { starts: starter[1]! });
  const exact: Record<string, string> = {
    "Il rendimento recente dipende soprattutto da una singola partita.": t("pp.insightIsolated"),
    "Sta creando più occasioni per i compagni rispetto al periodo precedente.": t("pp.insightCreator"),
    "Il calo dei tiri è accompagnato da una diminuzione dei tiri in porta.": t("pp.insightDeclineSot"),
    "L'aumento realizzativo non è accompagnato da una crescita equivalente del volume di tiro.":
      t("pp.insightGoalsNoShots")
  };
  if (exact[insight]) return exact[insight]!;
  const def = insight.match(
    /^(.+) mostra una produzione offensiva superiore alla media del proprio ruolo\.$/
  );
  if (def) return t("pp.insightDefault", { name: def[1]! });
  return insight;
}

export function indexLabel(key: keyof typeof PLAYER_PERFORMANCE_TEXT.indices): string {
  const map: Partial<Record<keyof typeof PLAYER_PERFORMANCE_TEXT.indices, string>> = {
    dangerIndex: t("pp.dangerIndex"),
    offensiveTrend: t("pp.offensiveTrend"),
    shotThreatIndex: t("pp.shotThreatIndex"),
    creatorIndex: t("pp.creatorIndex"),
    oneVsOneThreatIndex: t("pp.oneVsOneThreatIndex"),
    consistencyScore: t("pp.consistencyScore"),
    shotAccuracy: t("pp.shotAccuracy"),
    shotConversion: t("pp.shotConversion"),
    goalsPer90: t("pp.goalsPer90"),
    shotsPer90: t("pp.shotsPer90"),
    shotsOnTargetPer90: t("pp.shotsOnTargetPer90"),
    keyPassesPer90: t("pp.keyPassesPer90"),
    assistsPer90: t("pp.assistsPer90"),
    passAccuracy: t("pp.passAccuracy"),
    dribbleAttemptsPer90: t("pp.dribbleAttempts"),
    dribbleSuccessPer90: t("pp.dribbleSuccess"),
    dribbleSuccessRate: t("pp.dribbleSuccessRate"),
    foulsDrawnPer90: t("pp.foulsDrawn")
  };
  return map[key] ?? PLAYER_PERFORMANCE_TEXT.indices[key];
}
