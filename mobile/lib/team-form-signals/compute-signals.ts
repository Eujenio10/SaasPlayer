import type { TacticalMetrics } from "@/lib/types";
import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";
import {
  aggregateTeamRawStats,
  cardsProxyFromFouls,
  temporalBlend,
  type TeamRawSignalStats
} from "./aggregate";
import { COMPETITION_BASELINES as BL } from "./baselines";
import {
  buildKeyFactors,
  buildMainExplanation,
  buildTrendText,
  cardShortText,
  cornerShortText,
  resolveMainSignal,
  shotShortText,
  trendFromRatio
} from "./generate-text";
import { normalizeRatioToScore, scoreToLevel, levelLabelItalian, weightedMean } from "./normalize";
import { calculateSignalReliability } from "./reliability";
import type { SignalScore, TeamFormSignalsReport, TeamSignalStats } from "./types";

function resolveTeamIds(
  metrics: TacticalMetrics[],
  homeTeamId?: number
): { homeId: number; awayId: number; homeName: string; awayName: string } | null {
  const teamMap = new Map<number, string>();
  for (const row of metrics) {
    if (!teamMap.has(row.teamId)) teamMap.set(row.teamId, row.team);
  }
  const ids = [...teamMap.keys()];
  if (ids.length < 2) return null;

  let homeId = homeTeamId && teamMap.has(homeTeamId) ? homeTeamId : ids[0];
  let awayId = ids.find((id) => id !== homeId);
  if (awayId == null) return null;

  return {
    homeId,
    awayId,
    homeName: teamMap.get(homeId) ?? "Casa",
    awayName: teamMap.get(awayId) ?? "Trasferta"
  };
}

function buildSignalScore(score: number, shortText: string): SignalScore {
  const safe = Number.isFinite(score) ? Math.round(score) : 50;
  const level = scoreToLevel(safe);
  return {
    score: safe,
    level,
    label: levelLabelItalian(level),
    shortText
  };
}

function averageSpark(metrics: TacticalMetrics[], teamId: number): number {
  const rows = metrics.filter((r) => r.teamId === teamId);
  if (!rows.length) return 0;
  return rows.reduce((acc, r) => acc + (r.sparkIndex ?? 0), 0) / rows.length;
}

function computeShotSignal(home: TeamRawSignalStats, away: TeamRawSignalStats): number {
  const hFor = temporalBlend(home.shotsLast5, home.shotsLast2, home.shotsSeason);
  const aFor = temporalBlend(away.shotsLast5, away.shotsLast2, away.shotsSeason);
  const hAgainst = temporalBlend(away.shotsLast5, away.shotsLast2, away.shotsSeason);
  const aAgainst = temporalBlend(home.shotsLast5, home.shotsLast2, home.shotsSeason);

  const hSot = temporalBlend(
    home.shotsLast5 * 0.38,
    home.shotsLast2 * 0.38,
    home.shotsOnTargetSeason
  );
  const aSot = temporalBlend(
    away.shotsLast5 * 0.38,
    away.shotsLast2 * 0.38,
    away.shotsOnTargetSeason
  );

  const shotsForScore = normalizeRatioToScore(((hFor + aFor) / 2) / BL.shotsFor);
  const shotsAgainstScore = normalizeRatioToScore(((hAgainst + aAgainst) / 2) / BL.shotsAgainst);
  const sotScore = normalizeRatioToScore(((hSot + aSot) / 2) / BL.shotsOnTargetFor);
  const tempoScore = normalizeRatioToScore(
    ((home.activityIndex + away.activityIndex) / 2) / BL.activityTempo
  );

  return (
    weightedMean([
      { value: shotsForScore, weight: 0.35 },
      { value: shotsAgainstScore, weight: 0.35 },
      { value: sotScore, weight: 0.2 },
      { value: tempoScore, weight: 0.1 }
    ]) ?? 50
  );
}

function computeCornerSignal(home: TeamRawSignalStats, away: TeamRawSignalStats): number {
  const hFor = temporalBlend(home.cornersLast5, home.cornersLast5 * 0.95, home.cornersSeason);
  const aFor = temporalBlend(away.cornersLast5, away.cornersLast5 * 0.95, away.cornersSeason);
  const hAgainst = temporalBlend(
    away.cornersLast5,
    away.cornersLast5 * 0.95,
    away.cornersSeason
  );
  const aAgainst = temporalBlend(
    home.cornersLast5,
    home.cornersLast5 * 0.95,
    home.cornersSeason
  );

  const cornersForScore = normalizeRatioToScore(((hFor + aFor) / 2) / BL.cornersFor);
  const cornersAgainstScore = normalizeRatioToScore(((hAgainst + aAgainst) / 2) / BL.cornersAgainst);
  const pressureScore = normalizeRatioToScore(
    ((home.activityIndex + away.activityIndex) / 2) / BL.activityTempo
  );

  return (
    weightedMean([
      { value: cornersForScore, weight: 0.5 },
      { value: cornersAgainstScore, weight: 0.4 },
      { value: pressureScore, weight: 0.1 }
    ]) ?? 50
  );
}

function computeCardSignal(
  home: TeamRawSignalStats,
  away: TeamRawSignalStats,
  metrics: TacticalMetrics[],
  homeId: number,
  awayId: number
): number {
  const hCards = temporalBlend(
    cardsProxyFromFouls(home.foulsCommittedLast5),
    cardsProxyFromFouls(home.foulsCommittedLast2),
    cardsProxyFromFouls(home.foulsCommittedSeason)
  );
  const aCards = temporalBlend(
    cardsProxyFromFouls(away.foulsCommittedLast5),
    cardsProxyFromFouls(away.foulsCommittedLast2),
    cardsProxyFromFouls(away.foulsCommittedSeason)
  );

  const hFouls = temporalBlend(
    home.foulsCommittedLast5,
    home.foulsCommittedLast2,
    home.foulsCommittedSeason
  );
  const aFouls = temporalBlend(
    away.foulsCommittedLast5,
    away.foulsCommittedLast2,
    away.foulsCommittedSeason
  );

  const hSuffered = temporalBlend(
    home.foulsSufferedSeason,
    home.foulsSufferedSeason,
    home.foulsSufferedSeason
  );
  const aSuffered = temporalBlend(
    away.foulsSufferedSeason,
    away.foulsSufferedSeason,
    away.foulsSufferedSeason
  );

  const intensity = (averageSpark(metrics, homeId) + averageSpark(metrics, awayId)) / 2;
  const intensityScore = normalizeRatioToScore(intensity / 55);

  const cardsScore = normalizeRatioToScore(((hCards + aCards) / 2) / BL.cardsFor);
  const foulsScore = normalizeRatioToScore(((hFouls + aFouls) / 2) / BL.foulsCommitted);
  const sufferedScore = normalizeRatioToScore(((hSuffered + aSuffered) / 2) / BL.foulsSuffered);

  return (
    weightedMean([
      { value: cardsScore, weight: 0.35 },
      { value: foulsScore, weight: 0.3 },
      { value: sufferedScore, weight: 0.25 },
      { value: intensityScore, weight: 0.1 }
    ]) ?? 50
  );
}

function buildTeamComparisonStats(
  teamName: string,
  own: TeamRawSignalStats,
  opponent: TeamRawSignalStats
): TeamSignalStats {
  return {
    teamName,
    shotsFor: Number(temporalBlend(own.shotsLast5, own.shotsLast2, own.shotsSeason).toFixed(1)),
    shotsAgainst: Number(
      temporalBlend(opponent.shotsLast5, opponent.shotsLast2, opponent.shotsSeason).toFixed(1)
    ),
    cornersFor: Number(temporalBlend(own.cornersLast5, own.cornersLast5, own.cornersSeason).toFixed(1)),
    cornersAgainst: Number(
      temporalBlend(opponent.cornersLast5, opponent.cornersLast5, opponent.cornersSeason).toFixed(1)
    ),
    cardsFor: Number(
      cardsProxyFromFouls(
        temporalBlend(own.foulsCommittedLast5, own.foulsCommittedLast2, own.foulsCommittedSeason)
      ).toFixed(1)
    ),
    foulsCommitted: Number(
      temporalBlend(own.foulsCommittedLast5, own.foulsCommittedLast2, own.foulsCommittedSeason).toFixed(
        1
      )
    )
  };
}

function emptyReport(
  matchId: string,
  competition: string,
  homeTeam: string,
  awayTeam: string
): TeamFormSignalsReport {
  const neutral = buildSignalScore(50, "Dati non disponibili");
  return {
    matchId,
    competition,
    homeTeam,
    awayTeam,
    kickoff: "",
    sufficient: false,
    partialData: true,
    dataSource: "metrics_only",
    mainSignal: "none",
    mainSignalLabel: MATCH_DATA_UNAVAILABLE_MESSAGE,
    overallSignalScore: 0,
    shotSignal: neutral,
    cornerSignal: neutral,
    cardSignal: neutral,
    reliability: {
      level: "low",
      label: "Bassa",
      reasons: ["Statistiche insufficienti per calcolare segnali affidabili"]
    },
    explanation: MATCH_DATA_UNAVAILABLE_MESSAGE,
    keyFactors: [],
    teamComparison: {
      home: { teamName: homeTeam },
      away: { teamName: awayTeam }
    },
    trend: {
      shotsTrend: "unknown",
      cornersTrend: "unknown",
      cardsTrend: "unknown",
      text: "Trend recente non disponibile."
    }
  };
}

export function buildTeamFormSignalsReport(input: {
  metrics: TacticalMetrics[];
  eventId: number;
  homeTeamId?: number;
  homeName?: string;
  awayName?: string;
  competition?: string;
  kickoff?: string;
}): TeamFormSignalsReport {
  const { metrics, eventId, homeTeamId } = input;
  const teams = resolveTeamIds(metrics, homeTeamId);

  if (!teams || !metrics.length) {
    return emptyReport(
      String(eventId),
      input.competition ?? "Competizione",
      input.homeName ?? "Casa",
      input.awayName ?? "Trasferta"
    );
  }

  const home = aggregateTeamRawStats(metrics, teams.homeId, teams.homeName);
  const away = aggregateTeamRawStats(metrics, teams.awayId, teams.awayName);

  if (!home || !away) {
    return emptyReport(
      String(eventId),
      input.competition ?? "Competizione",
      input.homeName ?? teams.homeName,
      input.awayName ?? teams.awayName
    );
  }

  const hasShotsData = home.shotsSeason > 1 || away.shotsSeason > 1;
  const hasFoulsData =
    home.foulsCommittedSeason > 2 ||
    away.foulsCommittedSeason > 2 ||
    home.foulsSufferedSeason > 2;
  const sufficient = hasShotsData || hasFoulsData;

  if (!sufficient) {
    return emptyReport(
      String(eventId),
      input.competition ?? "Competizione",
      input.homeName ?? teams.homeName,
      input.awayName ?? teams.awayName
    );
  }

  const shotRaw = computeShotSignal(home, away);
  const cornerRaw = computeCornerSignal(home, away);
  const cardRaw = computeCardSignal(home, away, metrics, teams.homeId, teams.awayId);

  const shotSignal = buildSignalScore(shotRaw, "");
  shotSignal.shortText = shotShortText(shotSignal);
  const cornerSignal = buildSignalScore(cornerRaw, "");
  cornerSignal.shortText = cornerShortText(cornerSignal);
  const cardSignal = buildSignalScore(cardRaw, "");
  cardSignal.shortText = cardShortText(cardSignal);

  const hasLast5Samples = home.sampleLast5 + away.sampleLast5 >= 2;
  const partialData = !hasLast5Samples || !hasShotsData || !hasFoulsData;

  const reliability = calculateSignalReliability({
    home,
    away,
    hasShotsData,
    hasFoulsData,
    hasLast5Samples,
    usesCompetitionBaseline: true
  });

  const { mainSignal, mainSignalLabel, overallSignalScore } = resolveMainSignal(
    shotSignal,
    cornerSignal,
    cardSignal
  );

  const explanation = buildMainExplanation(
    mainSignal,
    shotSignal,
    cornerSignal,
    cardSignal,
    reliability
  );

  const shotsForAbove =
    (home.shotsSeason + away.shotsSeason) / 2 / BL.shotsFor >= 1.05;
  const shotsAgainstAbove =
    ((away.shotsSeason + home.shotsSeason) / 2) / BL.shotsAgainst >= 1.05;
  const cornersAbove = (home.cornersSeason + away.cornersSeason) / 2 / BL.cornersFor >= 1.05;
  const cardsAbove =
    (cardsProxyFromFouls(home.foulsCommittedSeason) +
      cardsProxyFromFouls(away.foulsCommittedSeason)) /
      2 /
      BL.cardsFor >=
    1.05;
  const bothTeamsOffensive = home.shotsSeason >= BL.shotsFor * 0.9 && away.shotsSeason >= BL.shotsFor * 0.9;

  const keyFactors = buildKeyFactors({
    shot: shotSignal,
    corner: cornerSignal,
    card: cardSignal,
    shotsForAbove,
    shotsAgainstAbove,
    cornersAbove,
    cardsAbove,
    bothTeamsOffensive,
    reliability
  });

  const shotsTrend = trendFromRatio(
    (home.shotsLast5 + away.shotsLast5) / 2,
    (home.shotsSeason + away.shotsSeason) / 2
  );
  const cornersTrend = trendFromRatio(
    (home.cornersLast5 + away.cornersLast5) / 2,
    (home.cornersSeason + away.cornersSeason) / 2
  );
  const cardsTrend = trendFromRatio(
    (cardsProxyFromFouls(home.foulsCommittedLast5) + cardsProxyFromFouls(away.foulsCommittedLast5)) / 2,
    (cardsProxyFromFouls(home.foulsCommittedSeason) + cardsProxyFromFouls(away.foulsCommittedSeason)) / 2
  );

  return {
    matchId: String(eventId),
    competition: input.competition ?? "Competizione",
    homeTeam: input.homeName ?? teams.homeName,
    awayTeam: input.awayName ?? teams.awayName,
    kickoff: input.kickoff ?? "",
    sufficient: true,
    partialData,
    dataSource: "metrics_only",
    mainSignal,
    mainSignalLabel,
    overallSignalScore,
    shotSignal,
    cornerSignal,
    cardSignal,
    reliability,
    explanation,
    keyFactors,
    teamComparison: {
      home: buildTeamComparisonStats(input.homeName ?? teams.homeName, home, away),
      away: buildTeamComparisonStats(input.awayName ?? teams.awayName, away, home)
    },
    trend: {
      shotsTrend,
      cornersTrend,
      cardsTrend,
      text: buildTrendText(shotsTrend, cornersTrend, cardsTrend)
    }
  };
}
