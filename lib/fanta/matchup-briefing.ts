import { minutesProfile, ratingToScore } from "@/lib/fanta/rating";
import type {
  FantaComputedPlayer,
  FantaDefenderLane,
  FantaMatchupBriefing,
  FantaMatchupBucket,
  FantaMatchupCard,
  FantaMatchupLane
} from "@/lib/fanta/types";

const MIN_AVG_RATING = 6.8;
const MIN_CONTINUITY_RATING = 6.5;
const MIN_AVG_MINUTES = 70;
const MIN_START_PCT = 60;
const FAVOREVOLI_MIN_SCORE = 70;
const LANE_LIMIT = 6;

type Locale = "it" | "en";

function mantraTokens(mantra: string | null | undefined): string[] {
  return (mantra ?? "")
    .split(/[;,/\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function defenderLaneForPlayer(player: FantaComputedPlayer): FantaDefenderLane | null {
  if (player.roleGroup !== "defender") return null;
  const tokens = mantraTokens(player.mantra);
  if (tokens.includes("E") || tokens.includes("B")) return "fullback";
  if ((tokens.includes("Dd") || tokens.includes("Ds")) && !tokens.includes("Dc")) return "fullback";
  return "central";
}

export function isFantaMatchupEligible(player: FantaComputedPlayer): boolean {
  if (!player.nextOpponentName || !player.matchup) return false;
  const recent = player.appearances.filter((row) => row.minutes >= 20).slice(-3);
  if (!recent.some((row) => row.minutes >= 45 || row.starter)) return false;
  const r5 = player.avgRating5;
  const r10 = player.avgRating10;
  const ratingOk = (r5 != null && r5 >= MIN_AVG_RATING) || (r10 != null && r10 >= MIN_AVG_RATING);
  const minutes = minutesProfile(player.appearances);
  const continuityOk =
    minutes.avgMinutes != null &&
    minutes.avgMinutes >= MIN_AVG_MINUTES &&
    (minutes.startPct ?? 0) >= MIN_START_PCT &&
    r5 != null &&
    r5 >= MIN_CONTINUITY_RATING;
  return ratingOk || continuityOk;
}

export function computeFantaMatchupDailyScore(player: FantaComputedPlayer): number {
  const qualityRating = ratingToScore(player.avgRating10 ?? player.avgRating5);
  const quality =
    qualityRating == null
      ? player.scores.pitchbrainFantaRating
      : qualityRating * 0.55 + player.scores.pitchbrainFantaRating * 0.45;
  const formBase = ratingToScore(player.avgRating5 ?? player.lastRating) ?? quality;
  const form = Math.max(0, Math.min(100, formBase + (player.trend === "up" ? 5 : player.trend === "down" ? -5 : 0)));
  const matchup = player.matchup?.matchupScore ?? player.scores.matchup ?? 50;
  return Math.round(quality * 0.4 + form * 0.3 + matchup * 0.3);
}

function assignBucket(player: FantaComputedPlayer, dailyScore: number): FantaMatchupBucket | null {
  const tone = player.matchup?.tone;
  if (!tone) return null;
  if (tone === "difficult") return "sfavorevole";
  if (tone === "favorable" && dailyScore >= FAVOREVOLI_MIN_SCORE) return "favorevole";
  return null;
}

function copy(locale: Locale) {
  const en = locale === "en";
  return {
    highForm: en ? "Strong recent form" : "Alta forma recente",
    highLevel: en ? "High-level player" : "Giocatore di livello alto",
    reliable: en ? "Reliable profile with solid minutes" : "Profilo affidabile, minuti solidi"
  };
}

function enrichCard(player: FantaComputedPlayer, dailyScore: number, bucket: FantaMatchupBucket, locale: Locale): FantaMatchupCard {
  const labels = copy(locale);
  const base = player.matchup;
  if (!base) {
    throw new Error("matchup_required");
  }
  const extras: string[] = [];
  if ((player.avgRating5 ?? 0) >= 7.2) extras.push(labels.highForm);
  if ((player.avgRating10 ?? player.avgRating5 ?? 0) >= 7.0 || player.scores.pitchbrainFantaRating >= 70) {
    extras.push(labels.highLevel);
  }
  const minutes = minutesProfile(player.appearances);
  if ((minutes.avgMinutes ?? 0) >= 75 && (minutes.startPct ?? 0) >= 70) extras.push(labels.reliable);

  const basePositive = Array.isArray(base.positiveFactors) ? base.positiveFactors : [];
  const baseNegative = Array.isArray(base.negativeFactors) ? base.negativeFactors : [];
  const fromReasons = (base.reasons ?? []).map((row) => row.text).filter(Boolean);
  const positiveFactors =
    bucket === "favorevole"
      ? [...extras, ...basePositive, ...fromReasons]
      : extras.length
        ? extras
        : basePositive.length
          ? basePositive
          : fromReasons;
  const negativeFactors = baseNegative;

  return {
    ...base,
    dailyScore,
    bucket,
    defenderLane: defenderLaneForPlayer(player),
    markingOpponentName: player.roleGroup === "defender" ? base.attackerName : null,
    avgRating5: player.avgRating5,
    positiveFactors: [...new Set(positiveFactors)].slice(0, 5),
    negativeFactors: [...new Set(negativeFactors)].slice(0, 5)
  };
}

function takeLane(cards: FantaMatchupCard[]): FantaMatchupLane {
  const favorevoli = cards
    .filter((row) => row.bucket === "favorevole")
    .sort((a, b) => b.dailyScore - a.dailyScore)
    .slice(0, LANE_LIMIT);
  const sfavorevoli = cards
    .filter((row) => row.bucket === "sfavorevole")
    .sort((a, b) => a.matchupScore - b.matchupScore || b.dailyScore - a.dailyScore)
    .slice(0, LANE_LIMIT);
  return { favorevoli, sfavorevoli };
}

export function buildFantaMatchupBriefing(
  players: FantaComputedPlayer[],
  locale: Locale = "it"
): FantaMatchupBriefing {
  const selected: FantaMatchupCard[] = [];
  for (const player of players) {
    if (!isFantaMatchupEligible(player)) continue;
    const dailyScore = computeFantaMatchupDailyScore(player);
    const bucket = assignBucket(player, dailyScore);
    if (!bucket) continue;
    selected.push(enrichCard(player, dailyScore, bucket, locale));
  }

  return {
    goalkeeper: takeLane(selected.filter((row) => row.roleGroup === "goalkeeper")),
    centralDefender: takeLane(selected.filter((row) => row.roleGroup === "defender" && row.defenderLane !== "fullback")),
    fullback: takeLane(selected.filter((row) => row.roleGroup === "defender" && row.defenderLane === "fullback")),
    midfielder: takeLane(selected.filter((row) => row.roleGroup === "midfielder")),
    forward: takeLane(selected.filter((row) => row.roleGroup === "forward"))
  };
}

export function flattenMatchupBriefing(briefing: FantaMatchupBriefing): FantaMatchupCard[] {
  return [
    ...briefing.forward.favorevoli,
    ...briefing.forward.sfavorevoli,
    ...briefing.midfielder.favorevoli,
    ...briefing.midfielder.sfavorevoli,
    ...briefing.fullback.favorevoli,
    ...briefing.fullback.sfavorevoli,
    ...briefing.centralDefender.favorevoli,
    ...briefing.centralDefender.sfavorevoli,
    ...briefing.goalkeeper.favorevoli,
    ...briefing.goalkeeper.sfavorevoli
  ];
}

export function emptyMatchupBriefing(): FantaMatchupBriefing {
  return {
    goalkeeper: { favorevoli: [], sfavorevoli: [] },
    centralDefender: { favorevoli: [], sfavorevoli: [] },
    fullback: { favorevoli: [], sfavorevoli: [] },
    midfielder: { favorevoli: [], sfavorevoli: [] },
    forward: { favorevoli: [], sfavorevoli: [] }
  };
}
