import type {
  KeyZoneLabel,
  MatchTypeLabel,
  PreMatchReportIndices,
  SetPieceWeightLabel,
  TempoLabel
} from "./types";
import type { TeamDerivedStats } from "./build-snapshot";
import { clamp } from "./normalize";

export function tempoLabelFromScore(score: number): TempoLabel {
  if (score >= 68) return "alto";
  if (score >= 58) return "medio_alto";
  if (score >= 42) return "medio";
  return "basso";
}

export function tempoLabelItalian(label: TempoLabel): string {
  const map: Record<TempoLabel, string> = {
    basso: "Basso",
    medio: "Medio",
    medio_alto: "Medio-alto",
    alto: "Alto"
  };
  return map[label];
}

export function setPieceWeightLabel(score: number): SetPieceWeightLabel {
  if (score >= 68) return "alto";
  if (score >= 55) return "medio_alto";
  if (score >= 42) return "medio";
  return "basso";
}

export function matchTypeFromIndices(indices: PreMatchReportIndices): MatchTypeLabel {
  const candidates: Array<{ type: MatchTypeLabel; score: number }> = [
    {
      type: "transizione",
      score: (indices.transitionThreatHome + indices.transitionThreatAway) / 2
    },
    {
      type: "palle_inattive",
      score: indices.setPieceWeight
    },
    {
      type: "fasce",
      score: (indices.wideThreatHome + indices.wideThreatAway) / 2
    },
    {
      type: "controllata",
      score: Math.max(indices.territorialControlHome, indices.territorialControlAway)
    },
    {
      type: "aperta",
      score: indices.matchTempo
    }
  ];
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  if (!top || top.score < 55) return "equilibrata";
  if (top.type === "controllata" && indices.matchBalance > 58) return "equilibrata";
  return top.type;
}

export function matchTypeLabelItalian(type: MatchTypeLabel): string {
  const map: Record<MatchTypeLabel, string> = {
    controllata: "Partita controllata",
    aperta: "Partita aperta",
    transizione: "Partita di transizione",
    fasce: "Partita da fasce",
    palle_inattive: "Partita da palle inattive",
    equilibrata: "Partita equilibrata"
  };
  return map[type];
}

export function computeMatchIndices(
  home: TeamDerivedStats | null,
  away: TeamDerivedStats | null,
  homeIdx: ReturnType<typeof import("./build-snapshot").computeTeamIndices>,
  awayIdx: ReturnType<typeof import("./build-snapshot").computeTeamIndices>
): PreMatchReportIndices {
  const matchTempo = clamp(
    Math.round(
      ((home?.activityIndex ?? 0) + (away?.activityIndex ?? 0)) / 2 / 18 * 50 +
        (homeIdx.offensive + awayIdx.offensive) / 4
    ),
    0,
    100
  );

  const balanceGap = Math.abs(homeIdx.territorial - awayIdx.territorial);
  const matchBalance = clamp(Math.round(100 - balanceGap * 0.85), 0, 100);

  const setPieceWeight = clamp(
    Math.round((homeIdx.setPiece + awayIdx.setPiece) / 2 + (home?.corners ?? 0) * 1.5),
    0,
    100
  );

  return {
    realFormHome: homeIdx.realForm,
    realFormAway: awayIdx.realForm,
    offensiveStrengthHome: homeIdx.offensive,
    offensiveStrengthAway: awayIdx.offensive,
    defensiveStabilityHome: homeIdx.defensive,
    defensiveStabilityAway: awayIdx.defensive,
    territorialControlHome: homeIdx.territorial,
    territorialControlAway: awayIdx.territorial,
    transitionThreatHome: homeIdx.transition,
    transitionThreatAway: awayIdx.transition,
    wideThreatHome: homeIdx.wide,
    wideThreatAway: awayIdx.wide,
    centralThreatHome: homeIdx.central,
    centralThreatAway: awayIdx.central,
    setPieceThreatHome: homeIdx.setPiece,
    setPieceThreatAway: awayIdx.setPiece,
    setPieceWeight,
    matchTempo,
    matchBalance
  };
}

export function pickKeyZone(
  home: TeamDerivedStats | null,
  away: TeamDerivedStats | null,
  indices: PreMatchReportIndices
): { zone: KeyZoneLabel; score: number; advantaged: "home" | "away" } {
  const zones: Array<{ zone: KeyZoneLabel; homeScore: number; awayScore: number }> = [
    {
      zone: "fascia_sinistra_casa",
      homeScore: indices.wideThreatHome + (home?.wingAttackLeft ?? 0) * 4,
      awayScore: (away?.wingAttackRight ?? 0) * 3
    },
    {
      zone: "fascia_destra_casa",
      homeScore: indices.wideThreatHome + (home?.wingAttackRight ?? 0) * 4,
      awayScore: (away?.wingAttackLeft ?? 0) * 3
    },
    { zone: "centrale", homeScore: indices.centralThreatHome, awayScore: indices.centralThreatAway },
    {
      zone: "area",
      homeScore: indices.offensiveStrengthHome * 0.6 + (100 - indices.defensiveStabilityAway) * 0.4,
      awayScore: indices.offensiveStrengthAway * 0.6 + (100 - indices.defensiveStabilityHome) * 0.4
    },
    {
      zone: "transizioni",
      homeScore: indices.transitionThreatHome,
      awayScore: indices.transitionThreatAway
    },
    {
      zone: "palle_inattive",
      homeScore: indices.setPieceThreatHome,
      awayScore: indices.setPieceThreatAway
    }
  ];

  let best = zones[0];
  let bestScore = 0;
  let advantaged: "home" | "away" = "home";

  for (const z of zones) {
    const score = Math.max(z.homeScore, z.awayScore);
    if (score > bestScore) {
      bestScore = score;
      best = z;
      advantaged = z.homeScore >= z.awayScore ? "home" : "away";
    }
  }

  return { zone: best.zone, score: clamp(Math.round(bestScore), 0, 100), advantaged };
}

export function keyZoneLabelItalian(
  zone: KeyZoneLabel,
  homeName: string,
  awayName: string
): string {
  void awayName;
  const map: Record<KeyZoneLabel, string> = {
    fascia_sinistra_casa: `Fascia sinistra ${homeName}`,
    fascia_destra_casa: `Fascia destra ${homeName}`,
    centrale: "Zona centrale",
    area: "Area di rigore",
    transizioni: "Transizioni",
    palle_inattive: "Palle inattive"
  };
  return map[zone];
}
