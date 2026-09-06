import { formatPlayerDisplayName, translateTeamName } from "@/lib/italian-sports-display";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

const BETTING_RE = /quot|scommess|odds|puntat|vincita|betting/i;

export function hoursUntilKickoff(kickoffUnix: number, nowUnix: number): number {
  return (kickoffUnix - nowUnix) / 3600;
}

export function isMatchPreviewWindow(hoursUntil: number): boolean {
  return hoursUntil >= 22 && hoursUntil <= 26;
}

export function isKeyMatchupWindow(hoursUntil: number): boolean {
  return hoursUntil >= 12 && hoursUntil < 22;
}

export function isInterestingKeyMatchup(matchup: DifficultMarkingMatchup): boolean {
  if (matchup.leadKind === "forward") return false;
  const score = matchup.difficultMarkingScore ?? 0;
  if (score >= 62) return true;
  return (
    matchup.difficultMarkingLevel === "extremely_difficult" ||
    matchup.difficultMarkingLevel === "very_difficult" ||
    matchup.difficultMarkingLevel === "difficult"
  );
}

export function pickKeyMatchupForFollowedTeam(
  matchups: DifficultMarkingMatchup[],
  teamId: number
): DifficultMarkingMatchup | null {
  const interesting = matchups
    .filter((item) => isInterestingKeyMatchup(item))
    .sort((a, b) => (b.difficultMarkingScore ?? 0) - (a.difficultMarkingScore ?? 0));
  const teamKey = String(teamId);
  const forTeam = interesting.filter(
    (item) => String(item.attackerTeamId) === teamKey || String(item.defenderTeamId) === teamKey
  );
  return forTeam[0] ?? interesting[0] ?? null;
}

function safeText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || BETTING_RE.test(trimmed)) return "";
  return trimmed;
}

export function keyMatchupReason(matchup: DifficultMarkingMatchup, locale: "it" | "en" = "it"): string {
  const attacker = formatPlayerDisplayName(matchup.attackerPlayerName);
  const fromReasons = matchup.reasons
    ?.map((row) => safeText(row.detail || row.label))
    .find(Boolean);
  if (fromReasons) return fromReasons;
  return locale === "en"
    ? `${attacker} faces a defender who concedes many individual duels.`
    : `${attacker} affronta un difensore che concede molti duelli individuali.`;
}

export function matchPreviewCopy(params: {
  home: string;
  away: string;
  locale?: "it" | "en";
}): { title: string; body: string } {
  const home = translateTeamName(params.home);
  const away = translateTeamName(params.away);
  const locale = params.locale ?? "it";
  if (locale === "en") {
    return {
      title: "PitchBrain Match Preview",
      body: `${home} vs ${away}: PitchBrain analysis is ready.`
    };
  }
  return {
    title: "PitchBrain Match Preview",
    body: `🔵 ${home} - ${away}: analisi PitchBrain disponibile`
  };
}

export function keyMatchupCopy(params: {
  home: string;
  away: string;
  matchup: DifficultMarkingMatchup;
  locale?: "it" | "en";
}): { title: string; body: string } {
  const home = translateTeamName(params.home);
  const away = translateTeamName(params.away);
  const locale = params.locale ?? "it";
  const attacker = formatPlayerDisplayName(params.matchup.attackerPlayerName);
  const defender = formatPlayerDisplayName(params.matchup.defenderPlayerName);
  const reason = keyMatchupReason(params.matchup, locale);
  if (locale === "en") {
    return {
      title: "PitchBrain Key Matchup",
      body: `${home} vs ${away}. ${attacker} vs ${defender}. ${reason}`
    };
  }
  return {
    title: "⚔️ Duello chiave individuato",
    body: `${home} - ${away}\n${attacker} vs ${defender}\n${reason}`
  };
}
