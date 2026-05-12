import { frictionHeatmapIsTrustedForUi } from "@/lib/friction-heatmap-validation";
import type { TacticalMetrics } from "@/lib/types";
import type { MatchupDetailModel, MatchupPlayerModel, MatchupReasonModel } from "./types";

const BLUE = "#0EA5E9";
const RED = "#EF4444";

function splitName(displayName: string): { first: string; last: string } {
  const parts = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { first: "—", last: "" };
  if (parts.length === 1) return { first: parts[0] ?? "—", last: "" };
  return { first: parts[0] ?? "—", last: parts.slice(1).join(" ") };
}

function roleLabelFromMetrics(m: TacticalMetrics): string {
  if (m.roleIcon === "🧤") return "PORTIERE";
  if (m.roleIcon === "🛡️") return "DIFENSORE";
  if (m.roleIcon === "🎯") return "ATTACCANTE";
  return "CENTROCAMPISTA";
}

function positionLabel(positionCode?: string): string {
  const s = (positionCode ?? "").trim();
  return s.length > 0 ? s.toUpperCase() : "N/D";
}

/** Proxy ammonizioni/medie quando i gialli espliciti non sono nel payload tattico. */
function estimatedYellowCardsAvg(m: TacticalMetrics): number {
  const foulsSeason = m.foulsCommittedSeasonAvg > 0 ? m.foulsCommittedSeasonAvg : m.foulsCommittedLastFiveAvg;
  const base = foulsSeason * 0.14;
  const boosted = base + (m.h2hHadCard ? 0.08 : 0);
  return Math.round(boosted * 10) / 10;
}

function collisionLabel(score: number): string {
  if (score >= 82) return "Molto alto";
  if (score >= 66) return "Alto";
  if (score >= 50) return "Medio";
  return "Moderato";
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
    .format(d)
    .replace(",", "");
}

function capitalizeWords(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function matchupPlayerFrom(left: TacticalMetrics, accent: "blue" | "red"): MatchupPlayerModel {
  const sp = splitName(left.playerName);
  return {
    firstName: sp.first,
    lastName: sp.last,
    team: left.team,
    roleLabel: roleLabelFromMetrics(left),
    position: positionLabel(left.positionCode),
    tacticalPositionCode: left.positionCode?.trim() || undefined,
    accent
  };
}

export function buildMatchupReasons(left: TacticalMetrics, right: TacticalMetrics): MatchupReasonModel[] {
  const a = capitalizeWords(left.playerName);
  const b = capitalizeWords(right.playerName);

  return [
    {
      id: "duel",
      title: "Duello diretto sulla fascia",
      description: `Entrambi agiscono nella stessa zona laterale, con alta probabilità di marcatura diretta (${a}, ${b}).`
    },
    {
      id: "foul_diff",
      title: "Differenza nel subire falli",
      description:
        `${b} subisce molti falli: ${a} è tra i marcatori più probabili e tra i profili più fallosi. Questo aumenta il rischio di interventi irregolari.`
    },
    {
      id: "booking",
      title: "Rischio ammonizione elevato",
      description:
        `Lo scontro unisce un profilo che commette molti falli e un avversario che attira contatti: rischio cartellino alto (${a}, ${b}).`
    }
  ];
}

export function buildMatchupDetailModel(
  rank: number,
  left: TacticalMetrics,
  right: TacticalMetrics
): MatchupDetailModel {
  const pa = matchupPlayerFrom(left, "blue");
  const pb = matchupPlayerFrom(right, "red");

  const subtitle =
    left.sparkNarrative ||
    `Possibile scontro in campo tra ${capitalizeWords(left.playerName)} e ${capitalizeWords(right.playerName)}, con profilo da duello tattico sulla stessa fascia.`;

  const collisionScore = Math.min(
    100,
    Math.round((left.sparkIndex + right.sparkIndex) / 2)
  );

  const rawHm = left.sparkFrictionHeatmap ?? null;

  return {
    rank,
    subtitle,
    playerA: pa,
    playerB: pb,
    collisionScore,
    collisionDescription:
      "Combinazione di falli commessi, falli subiti, dribbling e rischio ammonizione.",
    collisionScoreLabel: collisionLabel(collisionScore),
    metrics: [
      {
        id: "fouls_committed",
        label: "Falli commessi a partita",
        valueLeft: left.foulsCommittedSeasonAvg,
        valueRight: right.foulsCommittedSeasonAvg
      },
      {
        id: "fouls_suffered",
        label: "Falli subiti a partita",
        valueLeft: left.foulsSufferedSeasonAvg,
        valueRight: right.foulsSufferedSeasonAvg
      },
      {
        id: "dribbles",
        label: "Dribbling riusciti a partita",
        valueLeft: left.dribblesSeasonAvg ?? 0,
        valueRight: right.dribblesSeasonAvg ?? 0
      },
      {
        id: "yellows",
        label: "Ammonizioni a partita",
        valueLeft: estimatedYellowCardsAvg(left),
        valueRight: estimatedYellowCardsAvg(right),
        showYellowCards: true
      }
    ],
    heatmap: frictionHeatmapIsTrustedForUi(rawHm, {
      positionCodeA: left.positionCode,
      positionCodeB: right.positionCode
    })
      ? rawHm
      : null,
    reasons: buildMatchupReasons(left, right),
    updatedAtLabel: formatUpdatedAt(left.lastUpdated ?? new Date().toISOString())
  };
}

export const MATCHUP_COLORS = { blue: BLUE, red: RED, purple: "#8B5CF6" } as const;
