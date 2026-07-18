import type { TrendMetric, TrendMetricEvaluation, TrendReason, PlayerMatchTrendStats, TrendSampleMode } from "@/lib/trends/types";
import { metricLabelIt, metricUnitIt } from "@/lib/trends/text";

export function buildTrendReasons(params: {
  metric: TrendMetric;
  evaluation: TrendMetricEvaluation;
  roleChangedRecently: boolean;
  saveVolumeOnly?: boolean;
  saveVolumeAndEfficiency?: boolean;
  sampleMode?: TrendSampleMode;
}): TrendReason[] {
  const reasons: TrendReason[] = [];
  const unit = metricUnitIt(params.metric);
  const label = metricLabelIt(params.metric);
  const sampleMode = params.sampleMode ?? params.evaluation.sampleMode ?? "standard";
  const recentCount = params.evaluation.recent.matches;

  if (sampleMode === "short") {
    reasons.push({
      type: "SHORT_SAMPLE_FALLBACK",
      title: "Confronto su campione ridotto",
      detail: `Torneo con poche gare: ultime 2 presenze paragonate alla media delle ${params.evaluation.baseline.matches} giocate.`
    });
    reasons.push({
      type: "HIGH_RECENT_INCREASE",
      title: "Ultime 2 gare in crescita",
      detail: `${params.evaluation.recent.per90.toFixed(1)} ${unit} nelle ultime 2, contro ${params.evaluation.baseline.per90.toFixed(1)} di media totale.`
    });
  } else {
    reasons.push({
      type: "HIGH_RECENT_INCREASE",
      title: "Volume in forte crescita",
      detail: `${params.evaluation.recent.per90.toFixed(1)} ${unit} nelle ultime 5, contro ${params.evaluation.baseline.per90.toFixed(1)} nella baseline stagionale.`
    });
  }

  if (params.evaluation.matchesAboveBaseline >= (sampleMode === "short" ? 1 : 3)) {
    reasons.push({
      type: "CONSISTENT_TREND",
      title: sampleMode === "short" ? "Entrambe le gare recenti in salita" : "Aumento consistente",
      detail:
        sampleMode === "short"
          ? `${params.evaluation.matchesAboveBaseline} delle ultime 2 sopra la media totale delle presenze.`
          : `Ha superato la propria media in ${params.evaluation.matchesAboveBaseline} delle ultime 5 presenze.`
    });
  }

  if (sampleMode === "standard" && params.evaluation.survivesOutlierTest) {
    reasons.push({
      type: "OUTLIER_RESISTANT",
      title: "Non dipende da una sola partita",
      detail: "Il trend rimane positivo anche escludendo la miglior prestazione recente."
    });
  }

  if (params.roleChangedRecently) {
    reasons.push({
      type: "ROLE_CHANGE",
      title: "Ruolo più offensivo",
      detail: "La crescita coincide con un utilizzo più avanzato nelle ultime gare."
    });
  }

  if (params.metric === "saves" && params.saveVolumeOnly) {
    reasons.push({
      type: "VOLUME_SAVES",
      title: "Aumento del volume di parate",
      detail: "Più tiri subiti in porta da parare, non necessariamente maggiore efficienza."
    });
  }

  if (params.metric === "saves" && params.saveVolumeAndEfficiency) {
    reasons.push({
      type: "VOLUME_AND_EFFICIENCY_SAVES",
      title: "Volume ed efficienza in crescita",
      detail: "Aumentano sia le parate per 90 sia la percentuale di parate."
    });
  }

  if (params.evaluation.baseline.matches >= 10 && reasons.length < 4) {
    reasons.push({
      type: "STRONG_SAMPLE",
      title: "Campione stagionale solido",
      detail: `Baseline su ${params.evaluation.baseline.matches} presenze e ${params.evaluation.baseline.minutes} minuti.`
    });
  } else if (params.evaluation.baseline.matches < 10 && reasons.length < 4) {
    reasons.push({
      type: "LIMITED_SAMPLE",
      title: "Campione baseline contenuto",
      detail: `Baseline su ${params.evaluation.baseline.matches} presenze (${label}).`
    });
  }

  return reasons.slice(0, 4);
}

export function reliabilityLabelIt(score: number): string {
  if (score >= 0.8) return "Alta";
  if (score >= 0.65) return "Medio-alta";
  if (score >= 0.5) return "Media";
  return "Bassa";
}

export function secondaryMetricsFromAppearances(params: {
  recent: PlayerMatchTrendStats[];
  baseline: PlayerMatchTrendStats[];
}): NonNullable<import("@/lib/trends/types").PlayerTrend["secondaryMetrics"]> {
  const recentShots = aggregatePair(params.recent, "shots");
  const baselineShots = aggregatePair(params.baseline, "shots");
  const recentSot = aggregatePair(params.recent, "shotsOnTarget");
  const baselineSot = aggregatePair(params.baseline, "shotsOnTarget");
  const recentSaves = aggregatePair(params.recent, "saves");
  const baselineSaves = aggregatePair(params.baseline, "saves");
  const recentFaced = aggregatePair(params.recent, "shotsOnTargetFaced");
  const baselineFaced = aggregatePair(params.baseline, "shotsOnTargetFaced");

  return {
    shotsPer90: recentShots.per90,
    baselineShotsPer90: baselineShots.per90,
    shotsOnTargetPer90: recentSot.per90,
    baselineShotsOnTargetPer90: baselineSot.per90,
    shotAccuracy:
      recentShots.total > 0 ? recentSot.total / recentShots.total : null,
    baselineShotAccuracy:
      baselineShots.total > 0 ? baselineSot.total / baselineShots.total : null,
    savesPer90: recentSaves.per90,
    baselineSavesPer90: baselineSaves.per90,
    saveRate: recentFaced.total > 0 ? recentSaves.total / recentFaced.total : null,
    baselineSaveRate:
      baselineFaced.total > 0 ? baselineSaves.total / baselineFaced.total : null,
    shotsOnTargetFacedPer90: recentFaced.per90
  };
}

function aggregatePair(
  appearances: PlayerMatchTrendStats[],
  field: "shots" | "shotsOnTarget" | "saves" | "shotsOnTargetFaced"
): { total: number; minutes: number; per90: number } {
  let total = 0;
  let minutes = 0;
  for (const app of appearances) {
    const value = app[field];
    if (value == null) continue;
    total += value;
    minutes += app.minutesPlayed;
  }
  return {
    total,
    minutes,
    per90: minutes > 0 ? (total / minutes) * 90 : 0
  };
}
