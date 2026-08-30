import type { MatchupReason, PlayerRecentProfile } from "@/lib/difficult-markings/types";

export function buildReasonsForMatchup(params: {
  attacker: PlayerRecentProfile;
  defender: PlayerRecentProfile;
  overlapPct: number;
  attackerMetrics: Record<string, number | null>;
  defenderMetrics: Record<string, number | null>;
  usedHeatmap: boolean;
  extraAttackers?: Array<{ playerName: string }>;
  zonePressureLabel?: "Alta" | "Media" | "Bassa";
  difficultMarkingScore?: number;
}): MatchupReason[] {
  const reasons: MatchupReason[] = [];
  const foulsDrawn = params.attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = params.attacker.dribblesSuccessfulPer90 ?? 0;
  const extras = (params.extraAttackers ?? [])
    .map((a) => a.playerName)
    .filter((name) => name && name !== params.attacker.playerName);
  const score = params.difficultMarkingScore ?? 0;

  reasons.push({
    type: "OFFENSIVE_THREAT",
    label: "Motivo",
    detail:
      score >= 75
        ? "Elevato rischio di duelli persi e necessità di interventi fallosi."
        : score >= 55
          ? "Pressione ripetuta sulla zona: duelli e interventi a rischio fallo."
          : "Matchup da monitorare per dribbling e falli subiti dell’avversario."
  });

  reasons.push({
    type: "HIGH_FOULS_DRAWN",
    label: "Statistiche avversario",
    detail: `${foulsDrawn.toFixed(1)} falli subiti medi · ${dribblesOk.toFixed(1)} dribbling riusciti medi`
  });

  if (params.zonePressureLabel) {
    reasons.push({
      type: "ZONE_PRESSURE",
      label: "Pressione zona",
      detail: extras.length
        ? `${params.zonePressureLabel} · anche ${extras.join(", ")} occupano la stessa fascia`
        : params.zonePressureLabel
    });
  }

  if (extras.length) {
    reasons.push({
      type: "MULTI_ATTACKER_LOAD",
      label: "Altri giocatori coinvolti",
      detail: extras.join(", ")
    });
  }

  if (params.overlapPct >= 55 && reasons.length < 5) {
    reasons.push({
      type: "HIGH_SPATIAL_OVERLAP",
      label: params.usedHeatmap ? "Zone di gioco molto sovrapposte" : "Zone operative compatibili",
      detail: params.usedHeatmap
        ? `Sovrapposizione stimata dell’${params.overlapPct}%`
        : `Compatibilità spaziale stimata al ${params.overlapPct}% (senza heatmap)`
    });
  }

  return reasons.slice(0, 5);
}

export function reliabilityLabelIt(score: number): string {
  if (score >= 0.8) return "Alta";
  if (score >= 0.65) return "Medio-alta";
  if (score >= 0.5) return "Media";
  return "Bassa";
}
