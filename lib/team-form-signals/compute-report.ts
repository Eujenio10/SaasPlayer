import type { TeamPerformanceBlueprint, TacticalMetrics } from "@/lib/types";
import { teamShotsTrendFromMetrics } from "@/lib/prematch-report/build-blueprint-from-metrics";
import { isBlueprintPerMatchPlausible } from "@/lib/prematch-report/blueprint-validation";
import { aggregateMetricsTeam } from "./aggregate-metrics";
import { buildTeamSignalBundle, temporalBlend, type TeamSignalBundle } from "./build-team-bundle";
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
import { COMPETITION_BASELINES as BL, levelLabelItalian, normalizeRatioToScore, scoreToLevel, weightedMean } from "./normalize";
import { calculateSignalReliability } from "./reliability";
import type {
  SignalScore,
  TeamFormDataSource,
  TeamFormSignalsReport,
  TeamSignalStats
} from "./types";

function buildSignalScore(score: number, shortText: string): SignalScore {
  const safe = Number.isFinite(score) ? Math.round(score) : 50;
  const level = scoreToLevel(safe);
  return { score: safe, level, label: levelLabelItalian(level), shortText };
}

function computeShotSignal(home: TeamSignalBundle, away: TeamSignalBundle): number {
  const hFor = temporalBlend(home.shotsForLast5, home.shotsForLast2, home.shotsForSeason);
  const aFor = temporalBlend(away.shotsForLast5, away.shotsForLast2, away.shotsForSeason);
  const hAgainst = temporalBlend(
    home.shotsAgainstLast5,
    home.shotsAgainstLast2,
    home.shotsAgainstSeason
  );
  const aAgainst = temporalBlend(
    away.shotsAgainstLast5,
    away.shotsAgainstLast2,
    away.shotsAgainstSeason
  );

  const hSot = temporalBlend(
    home.shotsForLast5 * (home.shotsOnTargetSeason / Math.max(home.shotsForSeason, 0.1)),
    home.shotsForLast2 * (home.shotsOnTargetSeason / Math.max(home.shotsForSeason, 0.1)),
    home.shotsOnTargetSeason
  );
  const aSot = temporalBlend(
    away.shotsForLast5 * (away.shotsOnTargetSeason / Math.max(away.shotsForSeason, 0.1)),
    away.shotsForLast2 * (away.shotsOnTargetSeason / Math.max(away.shotsForSeason, 0.1)),
    away.shotsOnTargetSeason
  );

  return (
    weightedMean([
      { value: normalizeRatioToScore(((hFor + aFor) / 2) / BL.shotsFor), weight: 0.35 },
      { value: normalizeRatioToScore(((hAgainst + aAgainst) / 2) / BL.shotsAgainst), weight: 0.35 },
      { value: normalizeRatioToScore(((hSot + aSot) / 2) / BL.shotsOnTargetFor), weight: 0.2 },
      {
        value: normalizeRatioToScore(((home.activityIndex + away.activityIndex) / 2) / BL.activityTempo),
        weight: 0.1
      }
    ]) ?? 50
  );
}

function computeCornerSignal(home: TeamSignalBundle, away: TeamSignalBundle): number {
  const hFor = temporalBlend(home.cornersLast5, home.cornersLast5, home.cornersSeason);
  const aFor = temporalBlend(away.cornersLast5, away.cornersLast5, away.cornersSeason);
  const hAgainst = temporalBlend(
    home.cornersAgainstLast5,
    home.cornersAgainstLast5,
    home.cornersAgainstSeason
  );
  const aAgainst = temporalBlend(
    away.cornersAgainstLast5,
    away.cornersAgainstLast5,
    away.cornersAgainstSeason
  );

  return (
    weightedMean([
      { value: normalizeRatioToScore(((hFor + aFor) / 2) / BL.cornersFor), weight: 0.5 },
      { value: normalizeRatioToScore(((hAgainst + aAgainst) / 2) / BL.cornersAgainst), weight: 0.4 },
      {
        value: normalizeRatioToScore(((home.activityIndex + away.activityIndex) / 2) / BL.activityTempo),
        weight: 0.1
      }
    ]) ?? 50
  );
}

function computeCardSignal(home: TeamSignalBundle, away: TeamSignalBundle): number {
  const hCards = temporalBlend(home.cardsLast5, home.cardsLast5 * 0.95, home.cardsSeason);
  const aCards = temporalBlend(away.cardsLast5, away.cardsLast5 * 0.95, away.cardsSeason);
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
    home.foulsSufferedLast5,
    home.foulsSufferedLast5,
    home.foulsSufferedSeason
  );
  const aSuffered = temporalBlend(
    away.foulsSufferedLast5,
    away.foulsSufferedLast5,
    away.foulsSufferedSeason
  );
  const intensity = (home.activityIndex + away.activityIndex) / 2;

  return (
    weightedMean([
      { value: normalizeRatioToScore(((hCards + aCards) / 2) / BL.cardsFor), weight: 0.35 },
      { value: normalizeRatioToScore(((hFouls + aFouls) / 2) / BL.foulsCommitted), weight: 0.3 },
      { value: normalizeRatioToScore(((hSuffered + aSuffered) / 2) / BL.foulsSuffered), weight: 0.25 },
      { value: normalizeRatioToScore(intensity / BL.activityTempo), weight: 0.1 }
    ]) ?? 50
  );
}

function buildTeamComparisonStats(teamName: string, own: TeamSignalBundle): TeamSignalStats {
  const shotsFor = own.hasBlueprint
    ? own.shotsForSeason
    : temporalBlend(own.shotsForLast5, own.shotsForLast2, own.shotsForSeason);
  const shotsAgainst =
    own.shotsAgainstSeason > 0
      ? own.hasBlueprint
        ? own.shotsAgainstSeason
        : temporalBlend(own.shotsAgainstLast5, own.shotsAgainstLast2, own.shotsAgainstSeason)
      : temporalBlend(own.shotsAgainstLast5, own.shotsAgainstLast2, own.shotsAgainstSeason);
  const cornersFor = own.hasBlueprint
    ? own.cornersSeason
    : temporalBlend(own.cornersLast5, own.cornersLast5, own.cornersSeason);
  const cornersAgainst =
    own.cornersAgainstSeason > 0
      ? own.cornersAgainstSeason
      : temporalBlend(own.cornersAgainstLast5, own.cornersAgainstLast5, own.cornersAgainstSeason);
  const cardsFor = own.hasBlueprint
    ? own.cardsSeason
    : temporalBlend(own.cardsLast5, own.cardsLast5, own.cardsSeason);

  return {
    teamName,
    shotsFor: Number(shotsFor.toFixed(1)),
    shotsAgainst: Number(shotsAgainst.toFixed(1)),
    cornersFor: Number(cornersFor.toFixed(1)),
    cornersAgainst: Number(cornersAgainst.toFixed(1)),
    cardsFor: Number(cardsFor.toFixed(1)),
    foulsCommitted: Number(
      temporalBlend(own.foulsCommittedLast5, own.foulsCommittedLast2, own.foulsCommittedSeason).toFixed(1)
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
    mainSignalLabel: "Dati insufficienti",
    overallSignalScore: 0,
    shotSignal: neutral,
    cornerSignal: neutral,
    cardSignal: neutral,
    reliability: {
      level: "low",
      label: "Bassa",
      reasons: ["Statistiche insufficienti per calcolare segnali affidabili"]
    },
    explanation:
      "Non sono disponibili abbastanza statistiche per generare segnali affidabili su tiri, corner e cartellini per questa partita.",
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

function resolveDataSource(
  homeBlueprint: TeamPerformanceBlueprint | null,
  awayBlueprint: TeamPerformanceBlueprint | null,
  homePersisted: TeamPerformanceBlueprint | null,
  awayPersisted: TeamPerformanceBlueprint | null,
  providerTournamentStats?: boolean
): TeamFormDataSource {
  if (providerTournamentStats && homeBlueprint && awayBlueprint) return "provider_tournament";
  if (homePersisted && awayPersisted) return "blueprint_db";
  if (homeBlueprint || awayBlueprint) return "blueprint_computed";
  return "metrics_only";
}

export function buildTeamFormSignalsReport(input: {
  metrics: TacticalMetrics[];
  eventId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  competition?: string;
  kickoff?: string;
  homeBlueprint?: TeamPerformanceBlueprint | null;
  awayBlueprint?: TeamPerformanceBlueprint | null;
  homeBlueprintPersisted?: TeamPerformanceBlueprint | null;
  awayBlueprintPersisted?: TeamPerformanceBlueprint | null;
  providerTournamentStats?: boolean;
}): TeamFormSignalsReport {
  const homeTrend =
    input.homeBlueprint && isBlueprintPerMatchPlausible(input.homeBlueprint)
      ? { season: undefined, lastFive: undefined }
      : teamShotsTrendFromMetrics(input.metrics, input.homeTeamId);
  const awayTrend =
    input.awayBlueprint && isBlueprintPerMatchPlausible(input.awayBlueprint)
      ? { season: undefined, lastFive: undefined }
      : teamShotsTrendFromMetrics(input.metrics, input.awayTeamId);
  const homeMetrics = aggregateMetricsTeam(input.metrics, input.homeTeamId);
  const awayMetrics = aggregateMetricsTeam(input.metrics, input.awayTeamId);

  const home = buildTeamSignalBundle({
    blueprint: input.homeBlueprint ?? null,
    metrics: homeMetrics,
    teamId: input.homeTeamId,
    teamName: input.homeTeamName,
    shotsSeasonFromTrend: homeTrend.season,
    shotsLastFiveFromTrend: homeTrend.lastFive
  });
  const away = buildTeamSignalBundle({
    blueprint: input.awayBlueprint ?? null,
    metrics: awayMetrics,
    teamId: input.awayTeamId,
    teamName: input.awayTeamName,
    shotsSeasonFromTrend: awayTrend.season,
    shotsLastFiveFromTrend: awayTrend.lastFive
  });

  if (!home || !away) {
    return emptyReport(
      String(input.eventId),
      input.competition ?? "Competizione",
      input.homeTeamName,
      input.awayTeamName
    );
  }

  const hasShotsData =
    (home.hasBlueprint && home.shotsForSeason > 1) ||
    (away.hasBlueprint && away.shotsForSeason > 1) ||
    home.shotsForSeason > 1 ||
    away.shotsForSeason > 1;
  const hasFoulsData =
    home.foulsCommittedSeason > 2 ||
    away.foulsCommittedSeason > 2 ||
    home.foulsSufferedSeason > 2 ||
    away.foulsSufferedSeason > 2;

  if (!hasShotsData && !hasFoulsData) {
    return emptyReport(
      String(input.eventId),
      input.competition ?? "Competizione",
      input.homeTeamName,
      input.awayTeamName
    );
  }

  const dataSource = resolveDataSource(
    input.homeBlueprint ?? null,
    input.awayBlueprint ?? null,
    input.homeBlueprintPersisted ?? null,
    input.awayBlueprintPersisted ?? null,
    input.providerTournamentStats
  );

  const shotSignal = buildSignalScore(computeShotSignal(home, away), "");
  shotSignal.shortText = shotShortText(shotSignal);
  const cornerSignal = buildSignalScore(computeCornerSignal(home, away), "");
  cornerSignal.shortText = cornerShortText(cornerSignal);
  const cardSignal = buildSignalScore(computeCardSignal(home, away), "");
  cardSignal.shortText = cardShortText(cardSignal);

  const hasLast5Samples = home.sampleLast5 + away.sampleLast5 >= 2;
  const partialData =
    (dataSource !== "blueprint_db" && dataSource !== "provider_tournament") || !hasLast5Samples;

  const reliability = calculateSignalReliability({
    home,
    away,
    hasShotsData,
    hasFoulsData,
    hasLast5Samples,
    dataSource
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

  const keyFactors = buildKeyFactors({
    shot: shotSignal,
    corner: cornerSignal,
    card: cardSignal,
    shotsForAbove: (home.shotsForSeason + away.shotsForSeason) / 2 / BL.shotsFor >= 1.05,
    shotsAgainstAbove:
      ((home.shotsAgainstSeason + away.shotsAgainstSeason) / 2) / BL.shotsAgainst >= 1.05,
    cornersAbove: (home.cornersSeason + away.cornersSeason) / 2 / BL.cornersFor >= 1.05,
    cardsAbove: (home.cardsSeason + away.cardsSeason) / 2 / BL.cardsFor >= 1.05,
    bothTeamsOffensive:
      home.shotsForSeason >= BL.shotsFor * 0.9 && away.shotsForSeason >= BL.shotsFor * 0.9,
    reliability
  });

  const shotsTrend = trendFromRatio(
    (home.shotsForLast5 + away.shotsForLast5) / 2,
    (home.shotsForSeason + away.shotsForSeason) / 2
  );
  const cornersTrend = trendFromRatio(
    (home.cornersLast5 + away.cornersLast5) / 2,
    (home.cornersSeason + away.cornersSeason) / 2
  );
  const cardsTrend = trendFromRatio(
    (home.cardsLast5 + away.cardsLast5) / 2,
    (home.cardsSeason + away.cardsSeason) / 2
  );

  return {
    matchId: String(input.eventId),
    competition: input.competition ?? "Competizione",
    homeTeam: input.homeTeamName,
    awayTeam: input.awayTeamName,
    kickoff: input.kickoff ?? "",
    sufficient: true,
    partialData,
    dataSource,
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
      home: buildTeamComparisonStats(input.homeTeamName, home),
      away: buildTeamComparisonStats(input.awayTeamName, away)
    },
    trend: {
      shotsTrend,
      cornersTrend,
      cardsTrend,
      text: buildTrendText(shotsTrend, cornersTrend, cardsTrend)
    }
  };
}
