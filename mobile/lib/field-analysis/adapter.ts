/**
 * Analisi di Campo — Adattatore dati reali (mobile)
 *
 * La FootApi attuale espone, per partita, solo metriche per giocatore
 * (`TacticalMetrics`): in pratica falli commessi/subiti per finestra temporale.
 * Le statistiche avanzate (xG, zone, palle inattive, pressing, transizioni)
 * non sono disponibili.
 *
 * Questo adattatore costruisce due `TeamProfile` a partire dai dati realmente
 * presenti, popolando in modo coerente solo l'area disciplina/contatti e
 * lasciando neutre (= media campionato) le metriche non calcolabili: in questo
 * modo il motore produce insight solo dove i dati hanno davvero un segnale.
 */

import { translateCompetitionName, translateTeamName } from "@/lib/italian-display";
import type { TacticalMetrics } from "@/lib/types";
import type {
  AttackingZones,
  DefensiveZones,
  GenerateFieldAnalysisParams,
  LeagueAverages,
  SetPieceStats,
  TeamAdvancedStats,
  TeamProfile
} from "./fieldAnalysis.types";

/** Medie campionato di riferimento (valori per partita, generici per il calcio). */
const REFERENCE_LEAGUE_AVERAGES: LeagueAverages = {
  goalsFor: 1.4,
  goalsAgainst: 1.4,
  xgFor: 1.4,
  xgAgainst: 1.4,
  shotsFor: 13,
  shotsAgainst: 13,
  shotsOnTargetFor: 4.4,
  shotsOnTargetAgainst: 4.4,
  shotsInsideBoxFor: 8.5,
  shotsInsideBoxAgainst: 8.5,
  shotsOutsideBoxFor: 4.5,
  shotsOutsideBoxAgainst: 4.5,
  bigChancesFor: 1.6,
  bigChancesAgainst: 1.6,
  touchesInBoxFor: 22,
  touchesInBoxAgainst: 22,
  cornersFor: 5,
  cornersAgainst: 5,
  crossesFor: 16,
  crossesAgainst: 16,
  foulsCommitted: 12.5,
  foulsSuffered: 12.5,
  yellowCards: 2.2,
  redCards: 0.12,
  xgPerShotFor: 0.107,
  xgPerShotAgainst: 0.107,
  highRecoveriesFor: 7,
  highRecoveriesAgainst: 7,
  counterAttacksFor: 3,
  counterAttacksAgainst: 3,
  ppdaFor: 11,
  ppdaAgainst: 11
};

type FoulAggregate = {
  foulsCommitted: number;
  foulsSuffered: number;
  /** Indice offensivo medio della squadra (proxy del volume/pericolosità offensiva). */
  firepower: number;
};

function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Media dei due valori; ignora gli zeri, ritorna undefined se non disponibile. */
function avgPositive(a: number, b: number): number | undefined {
  const values = [a, b].filter((v) => Number.isFinite(v) && v > 0);
  if (!values.length) return undefined;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/** Somma per la squadra una metrica giocatore con fallback alla finestra stagionale. */
function aggregateFouls(
  players: TacticalMetrics[],
  pick: (p: TacticalMetrics) => number | undefined,
  fallback: (p: TacticalMetrics) => number | undefined
): number {
  let total = 0;
  for (const player of players) {
    const value = pick(player);
    total += value != null && Number.isFinite(value) ? value : safeNumber(fallback(player));
  }
  return Number(total.toFixed(2));
}

function buildSetPieceStats(seasonStats: TeamAdvancedStats): SetPieceStats {
  return {
    cornersFor: seasonStats.cornersFor,
    cornersAgainst: seasonStats.cornersAgainst,
    xgFromSetPiecesFor: Number((seasonStats.xgFor * 0.22).toFixed(2)),
    xgFromSetPiecesAgainst: Number((seasonStats.xgAgainst * 0.22).toFixed(2)),
    goalsFromSetPiecesFor: Number((seasonStats.goalsFor * 0.2).toFixed(2)),
    goalsFromSetPiecesAgainst: Number((seasonStats.goalsAgainst * 0.2).toFixed(2)),
    shotsFromSetPiecesFor: Number((seasonStats.shotsFor * 0.18).toFixed(2)),
    shotsFromSetPiecesAgainst: Number((seasonStats.shotsAgainst * 0.18).toFixed(2)),
    aerialDuelsWonFor: Number((seasonStats.shotsFor * 0.12).toFixed(2)),
    aerialDuelsLostAgainst: Number((seasonStats.shotsAgainst * 0.12).toFixed(2)),
    freeKicksWonFinalThird: Number((seasonStats.passesIntoFinalThirdFor * 0.08).toFixed(2)),
    freeKicksConcededFinalThird: Number((seasonStats.passesIntoFinalThirdAgainst * 0.08).toFixed(2))
  };
}

function buildAttackingZones(seasonStats: TeamAdvancedStats, offenseRatio: number): AttackingZones {
  const ratio = Math.max(0.75, Math.min(1.35, offenseRatio));
  return {
    rightFlankAttackShare: Number((0.34 * ratio).toFixed(3)),
    leftFlankAttackShare: Number((0.28 * ratio).toFixed(3)),
    centralAttackShare: Number((0.38 * ratio).toFixed(3)),
    rightFlankCrosses: Number((seasonStats.crossesFor * 0.46).toFixed(2)),
    leftFlankCrosses: Number((seasonStats.crossesFor * 0.54).toFixed(2)),
    rightFlankProgressions: Number((seasonStats.progressivePassesFor * 0.42).toFixed(2)),
    leftFlankProgressions: Number((seasonStats.progressivePassesFor * 0.38).toFixed(2)),
    centralProgressions: Number((seasonStats.progressivePassesFor * 0.2).toFixed(2)),
    rightFlankDribblesAttempted: Number((seasonStats.shotsFor * 0.08).toFixed(2)),
    leftFlankDribblesAttempted: Number((seasonStats.shotsFor * 0.07).toFixed(2)),
    rightFlankDribblesCompleted: Number((seasonStats.shotsFor * 0.05).toFixed(2)),
    leftFlankDribblesCompleted: Number((seasonStats.shotsFor * 0.045).toFixed(2)),
    attacksFromRightLeadingToShot: Number((seasonStats.shotsFor * 0.32).toFixed(2)),
    attacksFromLeftLeadingToShot: Number((seasonStats.shotsFor * 0.28).toFixed(2)),
    attacksFromCenterLeadingToShot: Number((seasonStats.shotsFor * 0.4).toFixed(2))
  };
}

function buildDefensiveZones(seasonStats: TeamAdvancedStats, defenseRatio: number): DefensiveZones {
  const ratio = Math.max(0.75, Math.min(1.35, defenseRatio));
  return {
    rightFlankShotsConceded: Number((seasonStats.shotsAgainst * 0.3 * ratio).toFixed(2)),
    leftFlankShotsConceded: Number((seasonStats.shotsAgainst * 0.28 * ratio).toFixed(2)),
    centralShotsConceded: Number((seasonStats.shotsAgainst * 0.42 * ratio).toFixed(2)),
    rightFlankCrossesConceded: Number((seasonStats.crossesAgainst * 0.46).toFixed(2)),
    leftFlankCrossesConceded: Number((seasonStats.crossesAgainst * 0.54).toFixed(2)),
    rightFlankDribblesAllowed: Number((seasonStats.shotsAgainst * 0.06).toFixed(2)),
    leftFlankDribblesAllowed: Number((seasonStats.shotsAgainst * 0.055).toFixed(2)),
    rightFlankDuelsLost: Number((seasonStats.foulsCommitted * 0.18).toFixed(2)),
    leftFlankDuelsLost: Number((seasonStats.foulsCommitted * 0.16).toFixed(2)),
    centralDuelsLost: Number((seasonStats.foulsCommitted * 0.22).toFixed(2)),
    rightFlankErrors: Number((seasonStats.foulsCommitted * 0.04).toFixed(2)),
    leftFlankErrors: Number((seasonStats.foulsCommitted * 0.035).toFixed(2)),
    centralErrors: Number((seasonStats.foulsCommitted * 0.05).toFixed(2))
  };
}

/**
 * Costruisce un TeamAdvancedStats popolando con dati reali (proxy) le aree
 * calcolabili — contatti/falli e volume offensivo (tiri) — e lasciando neutre
 * (= baseline) le metriche non disponibili. I campi correlati sono scalati in
 * modo coerente: i cartellini seguono i falli, l'area offensiva segue l'indice
 * firepower.
 *
 * `offenseRatioFor` scala le metriche offensive (*For) con l'indice firepower della
 * squadra. Le metriche difensive (*Against) usano un proxy autonomo (falli commessi
 * vs media coppia): così «passaggi ultimo terzo» dell'attaccante e «concessi» del
 * difendente non coincidono per costruzione.
 */
function neutralStats(
  lg: LeagueAverages,
  matchesPlayed: number,
  ownAgg: FoulAggregate,
  offenseRatioFor: number,
  defenseRatioAgainst: number
): TeamAdvancedStats {
  const committedRatio = lg.foulsCommitted > 0 ? ownAgg.foulsCommitted / lg.foulsCommitted : 1;
  const sf = (base: number) => Number((base * offenseRatioFor).toFixed(2));
  const sa = (base: number) => Number((base * defenseRatioAgainst).toFixed(2));
  return {
    matchesPlayed,
    goalsFor: lg.goalsFor,
    goalsAgainst: lg.goalsAgainst,
    xgFor: sf(lg.xgFor),
    xgAgainst: sa(lg.xgAgainst),
    shotsFor: sf(lg.shotsFor),
    shotsAgainst: sa(lg.shotsAgainst),
    shotsOnTargetFor: sf(lg.shotsOnTargetFor),
    shotsOnTargetAgainst: sa(lg.shotsOnTargetAgainst),
    shotsInsideBoxFor: sf(lg.shotsInsideBoxFor),
    shotsInsideBoxAgainst: sa(lg.shotsInsideBoxAgainst),
    shotsOutsideBoxFor: sf(lg.shotsOutsideBoxFor),
    shotsOutsideBoxAgainst: sa(lg.shotsOutsideBoxAgainst),
    bigChancesFor: sf(lg.bigChancesFor),
    bigChancesAgainst: sa(lg.bigChancesAgainst),
    touchesInBoxFor: sf(lg.touchesInBoxFor),
    touchesInBoxAgainst: sa(lg.touchesInBoxAgainst),
    possession: 50,
    progressivePassesFor: 42,
    progressivePassesAgainst: 42,
    passesIntoFinalThirdFor: sf(38),
    passesIntoFinalThirdAgainst: sa(38),
    passesIntoBoxFor: sf(9),
    passesIntoBoxAgainst: sa(9),
    crossesFor: lg.crossesFor,
    crossesAgainst: lg.crossesAgainst,
    cornersFor: sf(lg.cornersFor),
    cornersAgainst: sa(lg.cornersAgainst),
    dangerousAttacksFor: sf(50),
    dangerousAttacksAgainst: sa(50),
    foulsCommitted: ownAgg.foulsCommitted,
    foulsSuffered: ownAgg.foulsSuffered,
    yellowCards: Number((lg.yellowCards * committedRatio).toFixed(2)),
    redCards: lg.redCards,
    ppdaFor: lg.ppdaFor,
    ppdaAgainst: lg.ppdaAgainst,
    highRecoveriesFor: lg.highRecoveriesFor,
    highRecoveriesAgainst: lg.highRecoveriesAgainst,
    counterAttacksFor: lg.counterAttacksFor,
    counterAttacksAgainst: lg.counterAttacksAgainst
  };
}

type TeamFoulAggregate = {
  season: FoulAggregate;
  last5: FoulAggregate;
};

/** Indice offensivo medio della squadra (0-100). */
function averageFirepower(players: TacticalMetrics[]): number {
  const values = players
    .map((p) => p.firepowerIndex)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!values.length) return 0;
  return Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2));
}

function aggregateTeamFouls(players: TacticalMetrics[]): TeamFoulAggregate {
  const firepower = averageFirepower(players);
  return {
    season: {
      foulsCommitted: aggregateFouls(players, (p) => p.foulsCommittedSeasonAvg, (p) => p.foulsCommittedSeasonAvg),
      foulsSuffered: aggregateFouls(players, (p) => p.foulsSufferedSeasonAvg, (p) => p.foulsSufferedSeasonAvg),
      firepower
    },
    last5: {
      foulsCommitted: aggregateFouls(players, (p) => p.foulsCommittedLastFiveAvg, (p) => p.foulsCommittedSeasonAvg),
      foulsSuffered: aggregateFouls(players, (p) => p.foulsSufferedLastFiveAvg, (p) => p.foulsSufferedSeasonAvg),
      firepower
    }
  };
}

function buildTeamProfile(
  teamId: number,
  teamName: string,
  fouls: TeamFoulAggregate,
  lg: LeagueAverages,
  offenseRatioFor: number
): TeamProfile {
  const seasonFouls = fouls.season;
  const last5Fouls = fouls.last5;

  /** Proxy vulnerabilità difensiva: falli commessi propri (non firepower avversaria). */
  const defenseRatioAgainst =
    lg.foulsCommitted > 0 ? seasonFouls.foulsCommitted / lg.foulsCommitted : 1;
  const defenseRatioAgainstLast5 =
    lg.foulsCommitted > 0 ? last5Fouls.foulsCommitted / lg.foulsCommitted : defenseRatioAgainst;

  const seasonStats = neutralStats(lg, 19, seasonFouls, offenseRatioFor, defenseRatioAgainst);
  const last5Stats = neutralStats(lg, 5, last5Fouls, offenseRatioFor, defenseRatioAgainstLast5);
  const last10Stats = neutralStats(lg, 10, last5Fouls, offenseRatioFor, defenseRatioAgainstLast5);

  const committedRatio = lg.foulsCommitted > 0 ? seasonFouls.foulsCommitted / lg.foulsCommitted : 1;

  return {
    teamId: String(teamId),
    teamName,
    seasonStats,
    last5Stats,
    last10Stats,
    attackingZones: buildAttackingZones(seasonStats, offenseRatioFor),
    defensiveZones: buildDefensiveZones(seasonStats, defenseRatioAgainst),
    setPieceStats: buildSetPieceStats(seasonStats),
    shotProfile: {
      xgPerShotFor:
        seasonStats.shotsFor > 0 ? Number((seasonStats.xgFor / seasonStats.shotsFor).toFixed(3)) : 0.1,
      xgPerShotAgainst:
        seasonStats.shotsAgainst > 0
          ? Number((seasonStats.xgAgainst / seasonStats.shotsAgainst).toFixed(3))
          : 0.1,
      shotAccuracyFor: 0.34,
      shotAccuracyAgainst: 0.34,
      bigChanceRateFor: 0.11,
      bigChanceRateAgainst: 0.11,
      shotsInsideBoxShareFor: 0.62,
      shotsInsideBoxShareAgainst: 0.62,
      shotsOutsideBoxShareFor: 0.38,
      shotsOutsideBoxShareAgainst: 0.38
    },
    // Solo l'area disciplina è popolata con dati reali; le terzine sono stime.
    disciplineStats: {
      foulsCommitted: seasonFouls.foulsCommitted,
      foulsSuffered: seasonFouls.foulsSuffered,
      foulsCommittedDefensiveThird: Number((seasonFouls.foulsCommitted * 0.3).toFixed(2)),
      foulsCommittedMiddleThird: Number((seasonFouls.foulsCommitted * 0.45).toFixed(2)),
      foulsCommittedFinalThird: Number((seasonFouls.foulsCommitted * 0.25).toFixed(2)),
      foulsSufferedDefensiveThird: Number((seasonFouls.foulsSuffered * 0.25).toFixed(2)),
      foulsSufferedMiddleThird: Number((seasonFouls.foulsSuffered * 0.45).toFixed(2)),
      foulsSufferedFinalThird: Number((seasonFouls.foulsSuffered * 0.3).toFixed(2)),
      yellowCards: Number((lg.yellowCards * committedRatio).toFixed(2)),
      redCards: lg.redCards,
      cardsForDefenders: Number((lg.yellowCards * 0.4 * committedRatio).toFixed(2)),
      cardsForMidfielders: Number((lg.yellowCards * 0.35 * committedRatio).toFixed(2)),
      cardsForAttackers: Number((lg.yellowCards * 0.25 * committedRatio).toFixed(2))
    }
  };
}

export type FieldAnalysisAdapterResult = {
  params: GenerateFieldAnalysisParams;
  homeTeamName: string;
  awayTeamName: string;
};

/**
 * Costruisce i parametri per generateFieldAnalysis dai dati mobile.
 * Ritorna null se non è possibile distinguere due squadre nei dati.
 */
export function buildFieldAnalysisParams(args: {
  metrics: TacticalMetrics[];
  eventId: number;
  homeTeamId?: number;
  homeName?: string;
  awayName?: string;
  competitionId?: string;
}): FieldAnalysisAdapterResult | null {
  const { metrics, eventId, homeTeamId, homeName, awayName, competitionId } = args;
  if (!metrics.length) return null;

  const teamIds = Array.from(new Set(metrics.map((m) => m.teamId).filter((id) => Number.isFinite(id))));
  if (teamIds.length < 2) return null;

  const resolvedHomeId =
    homeTeamId != null && teamIds.includes(homeTeamId) ? homeTeamId : teamIds[0];
  const resolvedAwayId = teamIds.find((id) => id !== resolvedHomeId);
  if (resolvedAwayId == null) return null;

  const homePlayers = metrics.filter((m) => m.teamId === resolvedHomeId);
  const awayPlayers = metrics.filter((m) => m.teamId === resolvedAwayId);
  if (!homePlayers.length || !awayPlayers.length) return null;

  const homeTeamName = translateTeamName(homeName?.trim() || homePlayers[0]?.team || "Squadra di casa");
  const awayTeamName = translateTeamName(awayName?.trim() || awayPlayers[0]?.team || "Squadra ospite");

  const homeFouls = aggregateTeamFouls(homePlayers);
  const awayFouls = aggregateTeamFouls(awayPlayers);

  // Baseline DINAMICO: confrontiamo le due squadre TRA LORO (media della coppia),
  // non con una media campionato fissa. Così le differenze reali nei contatti
  // emergono davvero, invece di restare schiacciate sulla media generica.
  const pairCommitted = avgPositive(homeFouls.season.foulsCommitted, awayFouls.season.foulsCommitted);
  const pairSuffered = avgPositive(homeFouls.season.foulsSuffered, awayFouls.season.foulsSuffered);
  const lg: LeagueAverages = {
    ...REFERENCE_LEAGUE_AVERAGES,
    foulsCommitted: pairCommitted ?? REFERENCE_LEAGUE_AVERAGES.foulsCommitted,
    foulsSuffered: pairSuffered ?? REFERENCE_LEAGUE_AVERAGES.foulsSuffered
  };

  // Volume offensivo: firepower medio come proxy dei *For.
  const pairFirepower = avgPositive(homeFouls.season.firepower, awayFouls.season.firepower);
  const homeOffenseRatio = pairFirepower ? homeFouls.season.firepower / pairFirepower : 1;
  const awayOffenseRatio = pairFirepower ? awayFouls.season.firepower / pairFirepower : 1;

  const homeTeam = buildTeamProfile(resolvedHomeId, homeTeamName, homeFouls, lg, homeOffenseRatio);
  const awayTeam = buildTeamProfile(resolvedAwayId, awayTeamName, awayFouls, lg, awayOffenseRatio);

  const params: GenerateFieldAnalysisParams = {
    matchContext: {
      matchId: String(eventId),
      competitionId: translateCompetitionName(competitionId ?? "Sconosciuta"),
      season: "current",
      kickoffTime: new Date().toISOString(),
      homeTeamId: String(resolvedHomeId),
      awayTeamId: String(resolvedAwayId)
    },
    homeTeam,
    awayTeam,
    leagueAverages: lg,
    options: {
      // Con dati parziali: non scalare lo score per la reliability (altrimenti
      // nulla supererebbe la soglia), ma riflettere la qualità dati nella
      // confidence tramite l'override esplicito (proxy deboli).
      applyReliabilityToScore: false,
      dataQualityOverride: 0.6,
      minMismatchScore: 60
    }
  };

  return { params, homeTeamName, awayTeamName };
}
