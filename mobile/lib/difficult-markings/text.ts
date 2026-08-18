import type { DifficultMarkingMatchup } from "./types";

export function difficultMarkingSubjectLineIt(
  matchup: Pick<DifficultMarkingMatchup, "defenderPlayerName" | "attackerPlayerName"> & {
    extraAttackers?: Array<{ playerName: string }>;
  }
): string {
  const extraNames = (matchup.extraAttackers ?? [])
    .map((a) => a.playerName)
    .filter((name) => name && name !== matchup.attackerPlayerName);
  const names = [matchup.attackerPlayerName, ...extraNames];
  if (names.length === 1) {
    return `${matchup.defenderPlayerName} dovrà marcare ${names[0]}`;
  }
  if (names.length === 2) {
    return `${matchup.defenderPlayerName} dovrà marcare ${names[0]} e ${names[1]}`;
  }
  return `${matchup.defenderPlayerName} dovrà marcare ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function difficultMarkingSubjectHintIt(): string {
  return "Indice di difficoltà per il marcatore, su falli subiti e dribbling dell’avversario";
}

export function difficultMarkingAttackerThreatLineIt(
  matchup: Pick<DifficultMarkingMatchup, "attackerMetrics"> & {
    extraAttackers?: Array<{ playerName: string }>;
    markingLoadCount?: number;
  }
): string {
  const fouls = matchup.attackerMetrics.foulsDrawnPer90 ?? 0;
  const dribbles = matchup.attackerMetrics.dribblesSuccessfulPer90 ?? 0;
  const parts: string[] = [];
  if (fouls > 0) parts.push(`${fouls.toFixed(1)} falli subiti/90'`);
  if (dribbles > 0) parts.push(`${dribbles.toFixed(1)} dribbling riusciti/90'`);
  const extra = matchup.extraAttackers?.length ?? 0;
  if (extra > 0 || (matchup.markingLoadCount ?? 1) >= 2) {
    parts.push(`carico su ${Math.max(1 + extra, matchup.markingLoadCount ?? 1)} attaccanti difficili`);
  }
  return parts.length ? parts.join(" · ") : "Profilo offensivo limitato negli ultimi match";
}
