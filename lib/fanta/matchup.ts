import type { DifficultMarkingLevel, DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { formatPlayerDisplayName, translateTeamName } from "@/lib/italian-sports-display";
import { matchupReasons } from "@/lib/fanta/reasons";
import { fantaTeamsMatch } from "@/lib/fanta/quotazioni";
import { fantaRoleLabel } from "@/lib/fanta/roles";
import type { FantaAppearance, FantaMatchupCard, FantaMatchupTone } from "@/lib/fanta/types";

function idsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Prossimo avversario della squadra, anche se il giocatore non è in una Marcatura. */
export function nextOpponentForTeam(
  markings: DifficultMarkingMatchup[],
  teamId: string,
  teamName?: string
): string | null {
  const byId = markings.find(
    (item) => idsEqual(item.attackerTeamId, teamId) || idsEqual(item.defenderTeamId, teamId)
  );
  const hit =
    byId ??
    (teamName
      ? markings.find(
          (item) =>
            fantaTeamsMatch(item.homeTeamName, teamName) ||
            fantaTeamsMatch(item.awayTeamName, teamName) ||
            fantaTeamsMatch(item.attackerTeamName, teamName) ||
            fantaTeamsMatch(item.defenderTeamName, teamName)
        )
      : undefined);
  if (!hit) return null;

  const ownName = idsEqual(hit.attackerTeamId, teamId)
    ? translateTeamName(hit.attackerTeamName)
    : idsEqual(hit.defenderTeamId, teamId)
      ? translateTeamName(hit.defenderTeamName)
      : teamName ?? "";
  const home = translateTeamName(hit.homeTeamName);
  const away = translateTeamName(hit.awayTeamName);
  if (home && away) {
    if (fantaTeamsMatch(home, ownName) || (teamName && fantaTeamsMatch(home, teamName))) return away;
    if (fantaTeamsMatch(away, ownName) || (teamName && fantaTeamsMatch(away, teamName))) return home;
  }
  if (idsEqual(hit.attackerTeamId, teamId) || (teamName && fantaTeamsMatch(hit.attackerTeamName, teamName))) {
    return translateTeamName(hit.defenderTeamName);
  }
  return translateTeamName(hit.attackerTeamName);
}

export function fantaToneFromLevel(
  level: DifficultMarkingLevel,
  asAttacker: boolean
): FantaMatchupTone {
  const hard = level === "extremely_difficult" || level === "very_difficult";
  const mid = level === "difficult" || level === "monitor";
  if (asAttacker) {
    if (hard) return "favorable";
    if (mid) return "neutral";
    return "difficult";
  }
  if (hard) return "difficult";
  if (level === "difficult") return "neutral";
  return "favorable";
}

export function matchupScoreForPlayer(item: DifficultMarkingMatchup, playerId: string): number | null {
  const score = item.difficultMarkingScore;
  if (!Number.isFinite(score)) return null;
  if (idsEqual(item.attackerPlayerId, playerId)) return Math.max(0, Math.min(100, score));
  if (idsEqual(item.defenderPlayerId, playerId)) return Math.max(0, Math.min(100, 100 - score));
  return null;
}

function shotsPer90(appearances: FantaAppearance[] | undefined): number | null {
  if (!appearances?.length) return null;
  const sample = appearances.slice(-10);
  const minutes = sample.reduce((sum, row) => sum + row.minutes, 0);
  if (minutes < 90) return null;
  const shots = sample.reduce((sum, row) => sum + (row.shots ?? 0), 0);
  return Math.round(((shots * 90) / minutes) * 10) / 10;
}

function avgRating(appearances: FantaAppearance[] | undefined): number | null {
  if (!appearances?.length) return null;
  const ratings = appearances
    .slice(-5)
    .map((row) => row.ratingApi)
    .filter((n): n is number => n != null && n > 0);
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10;
}

export function toFantaMatchupCard(
  item: DifficultMarkingMatchup,
  options?: { appearances?: FantaAppearance[]; locale?: "it" | "en" }
): FantaMatchupCard {
  const locale = options?.locale ?? "it";
  const tone = fantaToneFromLevel(item.difficultMarkingLevel, true);
  const attackerTeam = translateTeamName(item.attackerTeamName);
  const defenderTeam = translateTeamName(item.defenderTeamName);
  const home = translateTeamName(item.homeTeamName);
  const away = translateTeamName(item.awayTeamName);
  const reasons = matchupReasons({
    tone,
    attackerName: item.attackerPlayerName,
    defenderTeamName: defenderTeam,
    locale
  });
  const classification = tone === "favorable" ? "favorevole" : tone === "difficult" ? "difficile" : "neutro";
  const attackerName = formatPlayerDisplayName(item.attackerPlayerName);
  return {
    matchupId: item.id,
    eventId: item.eventId,
    playerId: item.attackerPlayerId,
    playerName: attackerName,
    teamName: attackerTeam,
    roleGroup: "forward",
    roleLabel: fantaRoleLabel("forward", locale),
    mantra: null,
    nextOpponentName: defenderTeam,
    fixtureLabel: `${home} – ${away}`,
    matchupScore: Math.round(Math.max(0, Math.min(100, item.difficultMarkingScore))),
    classification,
    tone,
    headline: reasons[0]?.text ?? "",
    positiveFactors: tone === "favorable" ? reasons.map((row) => row.text) : [],
    negativeFactors: tone === "difficult" ? reasons.map((row) => row.text) : [],
    lens: "forward",
    dailyScore: Math.round(Math.max(0, Math.min(100, item.difficultMarkingScore))),
    bucket: tone === "favorable" ? "favorevole" : tone === "difficult" ? "sfavorevole" : "neutro",
    defenderLane: null,
    markingOpponentName: formatPlayerDisplayName(item.defenderPlayerName),
    avgRating5: avgRating(options?.appearances),
    attackerName,
    attackerTeamName: attackerTeam,
    defenderName: formatPlayerDisplayName(item.defenderPlayerName),
    defenderTeamName: defenderTeam,
    attacker: {
      dribblesPer90: item.attackerMetrics.dribblesSuccessfulPer90 ?? null,
      foulsDrawnPer90: item.attackerMetrics.foulsDrawnPer90 ?? null,
      avgRating: avgRating(options?.appearances),
      shotsHint: shotsPer90(options?.appearances)
    },
    defender: {
      dribblesConcededHint: null,
      foulsCommittedPer90: item.defenderMetrics.foulsCommittedPer90 ?? null,
      yellowPer90: item.defenderMetrics.yellowCardMatchRate ?? null,
      vulnerability: Number.isFinite(item.defenderVulnerabilityScore)
        ? Math.round(
            item.defenderVulnerabilityScore <= 1
              ? item.defenderVulnerabilityScore * 100
              : item.defenderVulnerabilityScore
          )
        : Math.round(item.difficultMarkingScore)
    },
    reasons
  };
}

export function pickPlayerMarking(
  markings: DifficultMarkingMatchup[],
  playerId: string
): DifficultMarkingMatchup | null {
  const asAttacker = markings.filter((item) => idsEqual(item.attackerPlayerId, playerId));
  const pool = asAttacker.length
    ? asAttacker
    : markings.filter((item) => idsEqual(item.defenderPlayerId, playerId));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore)[0] ?? null;
}

/** Una vista per attaccante e partita: attaccante vs difesa avversaria. */
export function collapseMarkingsToFantaViews(
  markings: DifficultMarkingMatchup[],
  locale: "it" | "en" = "it"
): FantaMatchupCard[] {
  const best = new Map<string, DifficultMarkingMatchup>();
  for (const item of markings) {
    const key = `${item.attackerPlayerId}:${item.fixtureId}`;
    const prev = best.get(key);
    if (!prev || item.difficultMarkingScore > prev.difficultMarkingScore) {
      best.set(key, item);
    }
  }
  return [...best.values()]
    .sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore)
    .map((item) => toFantaMatchupCard(item, { locale }));
}
