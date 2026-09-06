import {
  computeConsistencyScore,
  computeContributionScore,
  computePerformanceScore,
  computeProductionScore,
  lastNRatings,
  mean,
  minutesProfile
} from "@/lib/fanta/rating";
import {
  clampScore,
  opponentConcededScore,
  opponentLeakiness,
  scaleScore,
  teamCleanSheetRate,
  teamFormScore,
  teamQualityScore
} from "@/lib/fanta/team-context";
import type {
  FantaComputedPlayer,
  FantaDuelPillar,
  FantaDuelResult,
  FantaDuelSide,
  FantaRoleGroup
} from "@/lib/fanta/types";

export const FANTA_DUEL_ROLE_ERROR_IT =
  "Seleziona due giocatori dello stesso ruolo per effettuare il confronto.";
export const FANTA_DUEL_ROLE_ERROR_EN =
  "Select two players in the same position to compare them.";

const PILLAR_WEIGHTS = {
  recent: 0.25,
  production: 0.2,
  contribution: 0.15,
  minutes: 0.15,
  teamContext: 0.1,
  opponent: 0.1,
  teamForm: 0.05
} as const;

type Locale = "it" | "en";
type Winner = "a" | "b" | "tie";

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function fmt(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "n.d.";
  return n.toFixed(digits).replace(/\.0$/, "");
}

function productionForDuel(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[]
): number | null {
  const base = computeProductionScore(player.appearances, player.roleGroup);
  if (base == null) return null;
  const foulsDrawn = player.matchup?.attacker.foulsDrawnPer90;
  let score = base;
  if (player.roleGroup === "forward" && foulsDrawn != null) {
    score = clampScore(base * 0.88 + scaleScore(foulsDrawn, 0.4, 3.2) * 0.12);
  }
  if (player.roleGroup === "defender") {
    const cs = teamCleanSheetRate(catalog, player.teamId);
    if (cs != null) score = clampScore(score * 0.82 + scaleScore(cs, 0.15, 0.5) * 0.18);
  }
  return score;
}

function opponentScore(player: FantaComputedPlayer, catalog: FantaComputedPlayer[]): number | null {
  if (player.matchup?.matchupScore != null) return player.matchup.matchupScore;
  if (player.scores.matchup != null) return player.scores.matchup;
  const leakiness = opponentLeakiness(catalog, player.nextOpponentName);
  const conceded = opponentConcededScore(catalog, player.nextOpponentName);
  if (player.roleGroup === "goalkeeper") {
    if (leakiness != null) return clampScore(100 - leakiness);
    if (conceded != null) return clampScore(100 - conceded);
    return player.nextOpponentName ? 50 : null;
  }
  return leakiness ?? conceded ?? (player.nextOpponentName ? 50 : null);
}

function pillarWinner(scoreA: number | null, scoreB: number | null): Winner {
  if (scoreA == null || scoreB == null) return "tie";
  if (Math.abs(scoreA - scoreB) < 2.5) return "tie";
  return scoreA > scoreB ? "a" : "b";
}

function combineScore(
  parts: Array<{ w: number; v: number | null }>
): number {
  const available = parts.filter((row): row is { w: number; v: number } => row.v != null);
  if (!available.length) return 50;
  const totalW = available.reduce((sum, row) => sum + row.w, 0);
  return Math.round(clampScore(available.reduce((sum, row) => sum + row.v * (row.w / totalW), 0)));
}

function toSide(player: FantaComputedPlayer, fantaScore: number): FantaDuelSide {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    teamId: player.teamId,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    mantra: player.mantra,
    fantaScore,
    avgRating5: player.avgRating5,
    lastRating: player.lastRating,
    nextOpponentName: player.nextOpponentName,
    trend: player.trend
  };
}

function copy(locale: Locale) {
  const en = locale === "en";
  return {
    recent: en ? "Recent performances" : "Prestazioni recenti",
    production: en ? "Individual output" : "Produzione individuale",
    contribution: en ? "Goal / assist average" : "Media gol / assist",
    minutes: en ? "Minutes and starts" : "Minutaggio e titolarità",
    teamContext: en ? "Team context" : "Contesto squadra",
    opponent: en ? "Opponent" : "Avversario",
    teamForm: en ? "Recent team form" : "Forma recente della squadra",
    formEdge: en ? "Stronger recent form" : "Forma recente superiore",
    outputEdge: en ? "Higher individual output" : "Produzione individuale superiore",
    contribEdge: en ? "Higher attacking involvement" : "Maggiore partecipazione ai gol",
    minutesEdge: en ? "Greater continuity" : "Maggiore continuità",
    teamEdge: en ? "The team context favours more attacking opportunities." : "Il contesto squadra favorisce maggiori opportunità offensive.",
    oppFavorable: en ? "Favourable matchup" : "Matchup favorevole",
    oppDifficult: en ? "Demanding matchup" : "Matchup difficile",
    formUp: en ? "Team attacking output is rising." : "La squadra sta aumentando la produzione offensiva.",
    formDown: en ? "Team attacking output is cooling." : "La squadra sta creando meno.",
    highTeam: en ? "high attacking output" : "alta produzione offensiva",
    lowTeam: en ? "low attacking output" : "bassa produzione offensiva",
    midTeam: en ? "balanced attacking output" : "produzione offensiva equilibrata",
    points: en ? "pts" : "punti",
    contribLabel: en ? "attacking contributions/game" : "contributi offensivi/partita",
    gkConceded: en ? "goals conceded/game" : "gol subiti/partita",
    presence: en ? "appearances" : "presenze",
    starts: en ? "starts" : "titolare",
    vs: en ? "vs" : "contro",
    noData: en ? "n/a" : "n.d."
  };
}

function teamLabel(score: number | null, labels: ReturnType<typeof copy>): string {
  if (score == null) return labels.noData;
  if (score >= 66) return labels.highTeam;
  if (score <= 40) return labels.lowTeam;
  return labels.midTeam;
}

function edgeFor(winner: Winner, label: string): string | null {
  if (winner === "tie") return null;
  return label;
}

function motivationText(params: {
  locale: Locale;
  recommended: Winner;
  nameA: string;
  nameB: string;
  pillars: FantaDuelPillar[];
}): string {
  const en = params.locale === "en";
  if (params.recommended === "tie") {
    return en
      ? "The two profiles are aligned: the comparison does not show a clear edge."
      : "I due profili sono allineati: il confronto non evidenzia un vantaggio netto.";
  }
  const winner = params.recommended === "a" ? params.nameA : params.nameB;
  const won = params.pillars
    .filter((pillar) => pillar.winner === params.recommended)
    .map((pillar) => pillar.id);
  const bits: string[] = [];
  if (won.includes("recent")) bits.push(en ? "better recent form" : "una migliore forma recente");
  if (won.includes("minutes")) bits.push(en ? "greater continuity" : "maggiore continuità");
  if (won.includes("opponent")) bits.push(en ? "a more favourable matchup" : "un matchup più favorevole");
  if (won.includes("production")) bits.push(en ? "stronger individual output" : "una produzione individuale più solida");
  if (won.includes("contribution")) bits.push(en ? "higher attacking involvement" : "una maggiore partecipazione ai gol");
  if (won.includes("teamContext") || won.includes("teamForm")) {
    bits.push(en ? "a more productive team context" : "un contesto squadra più produttivo");
  }
  const reason =
    bits.slice(0, 3).join(en ? ", " : ", ") ||
    (en ? "a more complete on-pitch profile" : "un profilo di campo più completo");
  return en
    ? `${winner} offers a more favourable profile thanks to ${reason}.`
    : `Il giocatore presenta un profilo più favorevole grazie a ${reason}.`;
}

function blendFoulsIntoRecent(player: FantaComputedPlayer): number | null {
  const performance = computePerformanceScore(player.appearances);
  if (performance == null) return null;
  const trendBoost = player.trend === "up" ? 4 : player.trend === "down" ? -4 : 0;
  return clampScore(performance + trendBoost);
}

export function compareFantaDuel(params: {
  playerA: FantaComputedPlayer;
  playerB: FantaComputedPlayer;
  catalog: FantaComputedPlayer[];
  locale?: Locale;
}): FantaDuelResult {
  const locale = params.locale ?? "it";
  const labels = copy(locale);
  const a = params.playerA;
  const b = params.playerB;
  const catalog = params.catalog;

  const recentA = blendFoulsIntoRecent(a);
  const recentB = blendFoulsIntoRecent(b);
  const prodA = productionForDuel(a, catalog);
  const prodB = productionForDuel(b, catalog);
  const contribA = computeContributionScore(a.appearances, a.roleGroup);
  const contribB = computeContributionScore(b.appearances, b.roleGroup);
  const minutesA = computeConsistencyScore(a.appearances);
  const minutesB = computeConsistencyScore(b.appearances);
  const minutesMetaA = minutesProfile(a.appearances);
  const minutesMetaB = minutesProfile(b.appearances);
  const teamA = teamQualityScore(catalog, a.teamId);
  const teamB = teamQualityScore(catalog, b.teamId);
  const oppA = opponentScore(a, catalog);
  const oppB = opponentScore(b, catalog);
  const formA = teamFormScore(catalog, a.teamId);
  const formB = teamFormScore(catalog, b.teamId);

  const scoreA = combineScore([
    { w: PILLAR_WEIGHTS.recent, v: recentA },
    { w: PILLAR_WEIGHTS.production, v: prodA },
    { w: PILLAR_WEIGHTS.contribution, v: contribA.score },
    { w: PILLAR_WEIGHTS.minutes, v: minutesA },
    { w: PILLAR_WEIGHTS.teamContext, v: teamA },
    { w: PILLAR_WEIGHTS.opponent, v: oppA },
    { w: PILLAR_WEIGHTS.teamForm, v: formA }
  ]);
  const scoreB = combineScore([
    { w: PILLAR_WEIGHTS.recent, v: recentB },
    { w: PILLAR_WEIGHTS.production, v: prodB },
    { w: PILLAR_WEIGHTS.contribution, v: contribB.score },
    { w: PILLAR_WEIGHTS.minutes, v: minutesB },
    { w: PILLAR_WEIGHTS.teamContext, v: teamB },
    { w: PILLAR_WEIGHTS.opponent, v: oppB },
    { w: PILLAR_WEIGHTS.teamForm, v: formB }
  ]);

  const avg5A = round1(mean(lastNRatings(a.appearances, 5)));
  const avg5B = round1(mean(lastNRatings(b.appearances, 5)));
  const recentWinner = pillarWinner(recentA, recentB);
  const prodWinner = pillarWinner(prodA, prodB);
  const contribWinner = pillarWinner(contribA.score, contribB.score);
  const minutesWinner = pillarWinner(minutesA, minutesB);
  const teamWinner = pillarWinner(teamA, teamB);
  const oppWinner = pillarWinner(oppA, oppB);
  const formWinner = pillarWinner(formA, formB);

  const contribDetail = (perGame: number | null, role: FantaRoleGroup) => {
    if (perGame == null) return labels.noData;
    if (role === "goalkeeper") return `${fmt(perGame)} ${labels.gkConceded}`;
    return `${fmt(perGame, 2)} ${labels.contribLabel}`;
  };

  const minutesDetail = (meta: ReturnType<typeof minutesProfile>) => {
    if (meta.avgMinutes == null || meta.presencePct == null) return labels.noData;
    const start =
      meta.startPct == null ? "" : ` · ${Math.round(meta.startPct)}% ${labels.starts}`;
    return `${Math.round(meta.avgMinutes)} minuti medi · ${Math.round(meta.presencePct)}% ${labels.presence}${start}`;
  };

  const oppDetail = (player: FantaComputedPlayer, score: number | null) => {
    const vs = player.nextOpponentName ? ` ${labels.vs} ${player.nextOpponentName}` : "";
    if (score == null) return labels.noData + vs;
    if (score >= 62) return `${labels.oppFavorable}${vs}`;
    if (score <= 42) return `${labels.oppDifficult}${vs}`;
    return `${locale === "en" ? "Balanced matchup" : "Matchup equilibrato"}${vs}`;
  };

  const formDetail = (score: number | null) => {
    if (score == null) return labels.noData;
    if (score >= 58) return labels.formUp;
    if (score <= 42) return labels.formDown;
    return locale === "en" ? "Stable team output." : "Produzione di squadra stabile.";
  };

  const pillars: FantaDuelPillar[] = [
    {
      id: "recent",
      label: labels.recent,
      weight: PILLAR_WEIGHTS.recent,
      scoreA: recentA,
      scoreB: recentB,
      winner: recentWinner,
      detailA: avg5A != null ? `Media 5: ${fmt(avg5A)}` : labels.noData,
      detailB: avg5B != null ? `Media 5: ${fmt(avg5B)}` : labels.noData,
      edgeLabel: edgeFor(recentWinner, labels.formEdge)
    },
    {
      id: "production",
      label: labels.production,
      weight: PILLAR_WEIGHTS.production,
      scoreA: prodA,
      scoreB: prodB,
      winner: prodWinner,
      detailA: prodA != null ? `${Math.round(prodA)} ${labels.points}` : labels.noData,
      detailB: prodB != null ? `${Math.round(prodB)} ${labels.points}` : labels.noData,
      edgeLabel: edgeFor(prodWinner, labels.outputEdge)
    },
    {
      id: "contribution",
      label: labels.contribution,
      weight: PILLAR_WEIGHTS.contribution,
      scoreA: contribA.score,
      scoreB: contribB.score,
      winner: contribWinner,
      detailA: contribDetail(contribA.perGame, a.roleGroup),
      detailB: contribDetail(contribB.perGame, b.roleGroup),
      edgeLabel: edgeFor(contribWinner, labels.contribEdge)
    },
    {
      id: "minutes",
      label: labels.minutes,
      weight: PILLAR_WEIGHTS.minutes,
      scoreA: minutesA,
      scoreB: minutesB,
      winner: minutesWinner,
      detailA: minutesDetail(minutesMetaA),
      detailB: minutesDetail(minutesMetaB),
      edgeLabel: edgeFor(minutesWinner, labels.minutesEdge)
    },
    {
      id: "teamContext",
      label: labels.teamContext,
      weight: PILLAR_WEIGHTS.teamContext,
      scoreA: teamA,
      scoreB: teamB,
      winner: teamWinner,
      detailA: `${a.teamName || labels.noData}: ${teamLabel(teamA, labels)}`,
      detailB: `${b.teamName || labels.noData}: ${teamLabel(teamB, labels)}`,
      edgeLabel: edgeFor(teamWinner, labels.teamEdge)
    },
    {
      id: "opponent",
      label: labels.opponent,
      weight: PILLAR_WEIGHTS.opponent,
      scoreA: oppA,
      scoreB: oppB,
      winner: oppWinner,
      detailA: oppDetail(a, oppA),
      detailB: oppDetail(b, oppB),
      edgeLabel: edgeFor(oppWinner, labels.oppFavorable)
    },
    {
      id: "teamForm",
      label: labels.teamForm,
      weight: PILLAR_WEIGHTS.teamForm,
      scoreA: formA,
      scoreB: formB,
      winner: formWinner,
      detailA: formDetail(formA),
      detailB: formDetail(formB),
      edgeLabel: edgeFor(formWinner, formA != null && formA >= 58 ? labels.formUp : labels.formDown)
    }
  ];

  const recommended: Winner =
    Math.abs(scoreA - scoreB) < 2 ? "tie" : scoreA > scoreB ? "a" : "b";

  return {
    playerA: toSide(a, scoreA),
    playerB: toSide(b, scoreB),
    pillars,
    recommended,
    motivation: motivationText({
      locale,
      recommended,
      nameA: a.playerName,
      nameB: b.playerName,
      pillars
    })
  };
}

export function fantaDuelRoleError(locale: Locale): string {
  return locale === "en" ? FANTA_DUEL_ROLE_ERROR_EN : FANTA_DUEL_ROLE_ERROR_IT;
}

export function sameFantaRole(a: FantaRoleGroup, b: FantaRoleGroup): boolean {
  return a === b;
}
