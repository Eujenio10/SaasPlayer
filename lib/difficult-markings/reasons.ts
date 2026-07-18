import type { MatchupReason, PlayerRecentProfile } from "@/lib/difficult-markings/types";

function pctLabel(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.round(value * 100);
}

export function buildReasonsForMatchup(params: {
  attacker: PlayerRecentProfile;
  defender: PlayerRecentProfile;
  overlapPct: number;
  attackerMetrics: Record<string, number | null>;
  defenderMetrics: Record<string, number | null>;
  usedHeatmap: boolean;
}): MatchupReason[] {
  const reasons: MatchupReason[] = [];

  const foulsDrawn = params.attacker.foulsDrawnPer90;
  const foulsDrawnPct = params.attackerMetrics.foulsDrawnPercentile;
  if (foulsDrawn != null && foulsDrawn >= 2.2) {
    reasons.push({
      type: "HIGH_FOULS_DRAWN",
      label: "Subisce molti falli",
      detail: `${foulsDrawn.toFixed(1)} falli subiti ogni 90 minuti`,
      percentile: pctLabel(foulsDrawnPct)
    });
  }

  const dribbles = params.attacker.dribblesAttemptedPer90;
  const dribblesPct = params.attackerMetrics.dribblesAttemptedPercentile;
  if (dribbles != null && dribbles >= 3.5) {
    reasons.push({
      type: "HIGH_DRIBBLE_VOLUME",
      label: "Tenta molti dribbling",
      detail: `${dribbles.toFixed(1)} tentativi ogni 90 minuti`,
      percentile: pctLabel(dribblesPct)
    });
  }

  const dribblesOk = params.attacker.dribblesSuccessfulPer90;
  if (dribblesOk != null && dribblesOk >= 1.8 && reasons.length < 4) {
    reasons.push({
      type: "HIGH_DRIBBLE_SUCCESS",
      label: "Completa molti dribbling",
      detail: `${dribblesOk.toFixed(1)} dribbling riusciti ogni 90 minuti`,
      percentile: pctLabel(params.attackerMetrics.dribblesSuccessfulPercentile)
    });
  }

  if (params.overlapPct >= 55) {
    reasons.push({
      type: "HIGH_SPATIAL_OVERLAP",
      label: params.usedHeatmap ? "Zone di gioco molto sovrapposte" : "Zone operative compatibili",
      detail: params.usedHeatmap
        ? `Sovrapposizione stimata dell’${params.overlapPct}%`
        : `Compatibilità spaziale stimata al ${params.overlapPct}% (senza heatmap)`
    });
  }

  const foulsCommitted = params.defender.foulsCommittedPer90;
  const foulsCommittedPct = params.defenderMetrics.foulsCommittedPercentile;
  if (foulsCommitted != null && foulsCommitted >= 1.2) {
    reasons.push({
      type: "DEFENDER_FOUL_PROPENSITY",
      label: "Il marcatore commette molti falli",
      detail: `${foulsCommitted.toFixed(1)} falli ogni 90 minuti`,
      percentile: pctLabel(foulsCommittedPct)
    });
  }

  const yellowRate = params.defender.yellowCardMatchRate;
  if (yellowRate != null && yellowRate >= 0.22 && reasons.length < 4) {
    reasons.push({
      type: "DEFENDER_YELLOW_RISK",
      label: "Profilo disciplinare sensibile",
      detail: `Ammonizione in circa il ${Math.round(yellowRate * 100)}% delle partite analizzate`,
      percentile: pctLabel(params.defenderMetrics.yellowCardMatchRatePercentile)
    });
  }

  if (!params.usedHeatmap && reasons.length < 4) {
    reasons.push({
      type: "NO_HEATMAP",
      label: "Zona stimata dalla disposizione tattica",
      detail: "Heatmap non disponibile: la sovrapposizione usa ruolo, modulo e posizione media."
    });
  }

  if (params.attacker.sampleMatches < 6 || params.defender.sampleMatches < 6) {
    reasons.push({
      type: "LIMITED_SAMPLE",
      label: "Campione recente limitato",
      detail: `Attaccante ${params.attacker.sampleMatches} partite, marcatore ${params.defender.sampleMatches} partite`
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
