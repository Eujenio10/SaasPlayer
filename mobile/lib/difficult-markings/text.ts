import type { DifficultMarkingMatchup } from "./types";

type OverlapMatchup = Pick<
  DifficultMarkingMatchup,
  "attackerPlayerName" | "heatmapOverlapPct" | "extraAttackers"
> & {
  attackerMetrics?: DifficultMarkingMatchup["attackerMetrics"];
  zonePressureLabel?: DifficultMarkingMatchup["zonePressureLabel"];
  reasons?: DifficultMarkingMatchup["reasons"];
};

export function difficultMarkingOverlapEntries(matchup: OverlapMatchup): Array<{
  playerName: string;
  heatmapOverlapPct: number;
  foulsDrawnPer90: number | null;
}> {
  const extras = (matchup.extraAttackers ?? []).filter(
    (a) => a.playerName && a.playerName !== matchup.attackerPlayerName
  );
  return [
    {
      playerName: matchup.attackerPlayerName,
      heatmapOverlapPct: matchup.heatmapOverlapPct,
      foulsDrawnPer90: matchup.attackerMetrics?.foulsDrawnPer90 ?? null
    },
    ...extras.map((a) => ({
      playerName: a.playerName,
      heatmapOverlapPct: a.heatmapOverlapPct,
      foulsDrawnPer90: a.foulsDrawnPer90 ?? null
    }))
  ];
}

export function difficultMarkingOverlapBreakdownIt(matchup: OverlapMatchup): string {
  return difficultMarkingOverlapEntries(matchup)
    .map((entry) => {
      const fouls = entry.foulsDrawnPer90;
      const foulsBit = fouls != null ? ` (${fouls.toFixed(1)} falli/90')` : "";
      return `${entry.playerName} ${entry.heatmapOverlapPct}%${foulsBit}`;
    })
    .join(" · ");
}

export function difficultMarkingFoulsBreakdownIt(matchup: OverlapMatchup): string {
  return difficultMarkingOverlapEntries(matchup)
    .map((entry) => {
      const fouls = (entry.foulsDrawnPer90 ?? 0).toFixed(1);
      return `${entry.playerName} ${fouls} falli subiti/90'`;
    })
    .join(" · ");
}

export function difficultMarkingSubjectLineIt(
  matchup: Pick<DifficultMarkingMatchup, "defenderPlayerName" | "attackerPlayerName"> & {
    extraAttackers?: Array<{ playerName: string }>;
  }
): string {
  return `${matchup.defenderPlayerName} dovrà marcare ${matchup.attackerPlayerName}`;
}

export function difficultMarkingSubjectHintIt(): string {
  return "I 5 difensori più sotto pressione: matchup principale + sovraccarico di zona sulla heatmap.";
}

export function difficultMarkingKindLabelIt(
  matchup: Pick<DifficultMarkingMatchup, "markingKind" | "markingLoadCount">
): string {
  void matchup;
  return "Pressione sul marcatore";
}

export function difficultMarkingAttackerThreatLineIt(matchup: OverlapMatchup): string {
  const fouls = matchup.attackerMetrics?.foulsDrawnPer90 ?? 0;
  const dribbles = matchup.attackerMetrics?.dribblesSuccessfulPer90 ?? 0;
  return `${fouls.toFixed(1)} falli subiti medi · ${dribbles.toFixed(1)} dribbling riusciti medi`;
}

export function difficultMarkingZonePressureLineIt(matchup: OverlapMatchup): string {
  return `Pressione zona: ${matchup.zonePressureLabel ?? "Media"}`;
}

export function difficultMarkingOthersLineIt(matchup: OverlapMatchup): string | null {
  const extras = (matchup.extraAttackers ?? [])
    .map((a) => a.playerName)
    .filter((name) => name && name !== matchup.attackerPlayerName);
  if (!extras.length) return null;
  return `Altri in zona: ${extras.join(", ")}`;
}

export function difficultMarkingOpponents(matchup: DifficultMarkingMatchup): Array<{
  playerId: string;
  playerName: string;
  teamName: string;
  role: string;
  foulsDrawnPer90: number | null;
  dribblesSuccessfulPer90: number | null;
}> {
  const extras = (matchup.extraAttackers ?? []).filter(
    (attacker) => attacker.playerName && attacker.playerName !== matchup.attackerPlayerName
  );
  return [
    {
      playerId: matchup.attackerPlayerId,
      playerName: matchup.attackerPlayerName,
      teamName: matchup.attackerTeamName,
      role: matchup.attackerRole,
      foulsDrawnPer90: matchup.attackerMetrics?.foulsDrawnPer90 ?? null,
      dribblesSuccessfulPer90: matchup.attackerMetrics?.dribblesSuccessfulPer90 ?? null
    },
    ...extras.map((attacker) => ({
      playerId: attacker.playerId,
      playerName: attacker.playerName,
      teamName: matchup.attackerTeamName,
      role: "",
      foulsDrawnPer90: attacker.foulsDrawnPer90 ?? null,
      dribblesSuccessfulPer90: attacker.dribblesSuccessfulPer90 ?? null
    }))
  ];
}

export function difficultMarkingMotiveLineIt(matchup: OverlapMatchup): string {
  const motive = matchup.reasons?.find((r) => r.type === "OFFENSIVE_THREAT");
  return motive?.detail ?? "Matchup da monitorare per dribbling e falli subiti dell’avversario.";
}
