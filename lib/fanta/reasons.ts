import { formatPlayerDisplayName } from "@/lib/italian-sports-display";
import { mean } from "@/lib/fanta/rating";
import type {
  FantaAppearance,
  FantaMatchupTone,
  FantaReason,
  FantaTrendDirection
} from "@/lib/fanta/types";

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

export function scoutReasons(params: {
  appearances: FantaAppearance[];
  avgRating5: number | null;
  production: number | null;
  trend: FantaTrendDirection;
  tone: FantaMatchupTone | null;
  locale: "it" | "en";
}): FantaReason[] {
  const { appearances, avgRating5, production, trend, tone, locale } = params;
  const en = locale === "en";
  const reasons: FantaReason[] = [];
  if (avgRating5 != null) {
    reasons.push({
      code: "avg_rating_5",
      text: en
        ? `last-5 FootAPI rating average: ${fmt(avgRating5)}`
        : `rating medio ultime 5: ${fmt(avgRating5)}`
    });
  }
  if (production != null && production >= 62) {
    reasons.push({
      code: "high_volume",
      text: en ? "high on-pitch production volume" : "alto volume offensivo"
    });
  }
  if (tone === "favorable") {
    reasons.push({
      code: "favorable_matchup",
      text: en ? "advantageous individual matchup" : "matchup vantaggioso"
    });
  } else if (tone === "neutral") {
    reasons.push({
      code: "neutral_matchup",
      text: en ? "balanced matchup profile" : "matchup equilibrato"
    });
  } else if (tone === "difficult") {
    reasons.push({
      code: "difficult_matchup",
      text: en ? "demanding defensive matchup" : "matchup impegnativo"
    });
  }
  if (trend === "up") {
    reasons.push({
      code: "rising_form",
      text: en ? "positive recent rating trajectory" : "traiettoria di rating in crescita"
    });
  }
  const minutes = mean(appearances.slice(-5).map((row) => row.minutes));
  if (minutes != null && minutes >= 70) {
    reasons.push({
      code: "high_minutes",
      text: en ? "solid recent playing-time profile" : "profilo di minuti recente solido"
    });
  }
  if (!reasons.length) {
    reasons.push({
      code: "limited_sample",
      text: en
        ? "limited sample: rating built from available stats"
        : "campione limitato: indice costruito sulle statistiche disponibili"
    });
  }
  return reasons.slice(0, 4);
}

export function matchupReasons(params: {
  tone: FantaMatchupTone;
  attackerName: string;
  defenderTeamName: string;
  locale: "it" | "en";
}): FantaReason[] {
  const attacker = formatPlayerDisplayName(params.attackerName);
  const defense = params.defenderTeamName;
  const en = params.locale === "en";
  if (params.tone === "favorable") {
    return [
      {
        code: "favorable_profile",
        text: en
          ? `${attacker}: favorable profile vs ${defense} defence`
          : `${attacker}: profilo favorevole contro la difesa ${defense}`
      }
    ];
  }
  if (params.tone === "difficult") {
    return [
      {
        code: "difficult_profile",
        text: en
          ? `${attacker}: demanding matchup vs ${defense} defence`
          : `${attacker}: matchup impegnativo contro la difesa ${defense}`
      }
    ];
  }
  return [
    {
      code: "neutral_profile",
      text: en
        ? `${attacker}: balanced matchup vs ${defense} defence`
        : `${attacker}: matchup equilibrato contro la difesa ${defense}`
    }
  ];
}

export function lineupReasons(params: {
  avgRating5: number | null;
  production: number | null;
  tone: FantaMatchupTone | null;
  trend: FantaTrendDirection;
  locale: "it" | "en";
}): FantaReason[] {
  const base = scoutReasons({
    appearances: [],
    avgRating5: params.avgRating5,
    production: params.production,
    trend: params.trend,
    tone: params.tone,
    locale: params.locale
  });
  if (params.production != null && params.production >= 55 && params.avgRating5 != null && params.avgRating5 >= 6.8) {
    base.unshift({
      code: "positive_profile",
      text:
        params.locale === "en"
          ? "elevated chance of a positive performance"
          : "elevata possibilità di prestazione positiva"
    });
  }
  return base.slice(0, 4);
}
