import type { DifficultMarkingMatchup } from "./types";

export function difficultMarkingSubjectLineIt(
  matchup: Pick<DifficultMarkingMatchup, "defenderPlayerName" | "attackerPlayerName">
): string {
  return `${matchup.defenderPlayerName} dovrà marcare ${matchup.attackerPlayerName}`;
}

export function difficultMarkingSubjectHintIt(): string {
  return "Indice di difficoltà per il marcatore";
}

export function difficultMarkingAttackerThreatLineIt(
  matchup: Pick<DifficultMarkingMatchup, "attackerMetrics">
): string {
  const fouls = matchup.attackerMetrics.foulsDrawnPer90 ?? 0;
  const dribbles = matchup.attackerMetrics.dribblesSuccessfulPer90 ?? 0;
  const parts: string[] = [];
  if (fouls > 0) parts.push(`${fouls.toFixed(1)} falli subiti/90'`);
  if (dribbles > 0) parts.push(`${dribbles.toFixed(1)} dribbling riusciti/90'`);
  return parts.length ? parts.join(" · ") : "Profilo offensivo limitato negli ultimi match";
}
