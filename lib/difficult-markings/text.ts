import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

/** Il marcatore (difensore) è il soggetto sotto pressione. */
export function difficultMarkingSubjectLineIt(
  matchup: Pick<
    DifficultMarkingMatchup,
    "defenderPlayerName" | "attackerPlayerName" | "extraAttackers"
  >
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
  matchup: Pick<DifficultMarkingMatchup, "attackerMetrics" | "extraAttackers" | "markingLoadCount">
): string {
  const fouls = matchup.attackerMetrics.foulsDrawnPer90 ?? 0;
  const dribbles = matchup.attackerMetrics.dribblesSuccessfulPer90 ?? 0;
  const parts: string[] = [];
  if (fouls > 0) parts.push(`${fouls.toFixed(1)} falli subiti/90'`);
  if (dribbles > 0) parts.push(`${dribbles.toFixed(1)} dribbling riusciti/90'`);
  const load = matchup.markingLoadCount ?? 1 + (matchup.extraAttackers?.length ?? 0);
  if ((matchup.extraAttackers?.length ?? 0) > 0 || load >= 2) {
    const n = Math.max(load, 1 + (matchup.extraAttackers?.length ?? 0));
    parts.push(`carico su ${n} attaccanti difficili`);
  }
  return parts.length ? parts.join(" · ") : "Profilo offensivo limitato negli ultimi match";
}
