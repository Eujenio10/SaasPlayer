/**
 * Analisi di Campo — Motore principale
 *
 * generateFieldAnalysis() produce una lettura tecnica pre-match: confronta i
 * punti di forza di una squadra con le fragilità dell'avversaria e restituisce
 * fino a 7 insight ordinati per rilevanza (mismatchScore >= 60).
 *
 * Nessun pronostico, nessuna indicazione di esito o di scommessa.
 */

import {
  buildMetricBreakdown,
  calculateConfidence,
  calculateDataQualityFactor,
  calculateLevel,
  calculateLineupFactor,
  calculateMismatchScore,
  calculateMetricScore,
  calculateRefereeFactor,
  calculateReliabilityFactor,
  calculateSampleFactor,
  calculateStrengthScore,
  calculateWeaknessScore,
  clamp,
  isFiniteNumber,
  normalizeInverseStat,
  normalizeStat,
  normalizedToScore,
  round,
  type LineupStatus,
  type StatsWindow,
  type WindowScore
} from "./fieldAnalysis.scoring";
import {
  buildEvidence,
  buildGlobalSummary,
  buildInsightText,
  buildKeyStats,
  findForbiddenWords
} from "./fieldAnalysis.text";
import {
  MAX_INSIGHTS,
  MIN_MISMATCH_SCORE,
  type CategoryResult,
  type FieldAnalysisResult,
  type FieldInsight,
  type FieldZone,
  type GenerateFieldAnalysisParams,
  type LeagueAverages,
  type MetricBreakdown,
  type MetricDirection,
  type PlayerProfile,
  type TeamAdvancedStats,
  type TeamProfile
} from "./fieldAnalysis.types";

/* ------------------------------------------------------------------ */
/* Definizione metriche                                                */
/* ------------------------------------------------------------------ */

type AdvancedGetter = (s: TeamAdvancedStats) => number | undefined;
type SubGetter = (t: TeamProfile) => number | undefined;

type MetricSpec = {
  label: string;
  direction: MetricDirection;
  inverse?: boolean;
  baseline: (lg: LeagueAverages) => number | undefined;
  /** Metrica con finestre temporali (season/last5/last10/home-away/opponentAdjusted). */
  advanced?: AdvancedGetter;
  /** Metrica da snapshot singolo (zone, set piece, duelli, ...). */
  sub?: SubGetter;
  subSource?: MetricBreakdown["source"];
};

const ALL_WINDOWS: StatsWindow[] = [
  "season",
  "last5",
  "last10",
  "homeAway",
  "opponentAdjusted"
];

function windowStats(
  team: TeamProfile,
  window: StatsWindow,
  isHome: boolean
): TeamAdvancedStats | undefined {
  switch (window) {
    case "season":
      return team.seasonStats;
    case "last5":
      return team.last5Stats;
    case "last10":
      return team.last10Stats;
    case "homeAway":
      return isHome ? team.homeStats : team.awayStats;
    case "opponentAdjusted":
      return team.opponentAdjustedStats;
    default:
      return undefined;
  }
}

/**
 * Valuta una singola metrica e ritorna il relativo MetricBreakdown,
 * oppure null se i dati non permettono un confronto significativo.
 */
function evaluateMetric(
  spec: MetricSpec,
  team: TeamProfile,
  isHome: boolean,
  lg: LeagueAverages
): MetricBreakdown | null {
  const baseline = spec.baseline(lg);
  if (!isFiniteNumber(baseline) || baseline <= 0) return null;

  const normalize = (value: number): number | undefined =>
    spec.inverse ? normalizeInverseStat(value, baseline) : normalizeStat(value, baseline);

  if (spec.advanced) {
    const windowScores: WindowScore[] = [];
    let repValue: number | undefined;
    let repNormalized: number | undefined;

    for (const window of ALL_WINDOWS) {
      const stats = windowStats(team, window, isHome);
      if (!stats) continue;
      const value = spec.advanced(stats);
      if (!isFiniteNumber(value)) continue;
      const normalized = normalize(value);
      if (normalized == null) continue;
      const score = normalizedToScore(normalized);
      windowScores.push({ window, score });
      if (repValue == null || window === "season") {
        repValue = value;
        repNormalized = normalized;
      }
    }

    if (!windowScores.length || repValue == null) return null;
    const score = calculateMetricScore(windowScores);
    return buildMetricBreakdown({
      metric: spec.label,
      value: repValue,
      leagueAverage: baseline,
      normalized: repNormalized,
      score,
      direction: spec.direction,
      source: "season"
    });
  }

  if (spec.sub) {
    const value = spec.sub(team);
    if (!isFiniteNumber(value)) return null;
    const normalized = normalize(value);
    if (normalized == null) return null;
    const score = normalizedToScore(normalized);
    return buildMetricBreakdown({
      metric: spec.label,
      value,
      leagueAverage: baseline,
      normalized,
      score,
      direction: spec.direction,
      source: spec.subSource ?? "season"
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Baseline di supporto                                                */
/* ------------------------------------------------------------------ */

/**
 * Baseline euristiche per metriche prive di una media campionato dedicata
 * (zone, progressioni, passaggi). Valori per-partita ragionevoli, usati solo
 * come riferimento di normalizzazione.
 */
const HEURISTIC_BASELINES = {
  flankAttackShare: 0.3,
  centralAttackShare: 0.4,
  flankProgressions: 18,
  centralProgressions: 24,
  flankDribblesCompleted: 3,
  flankDribblesAllowed: 3,
  flankDuelsLost: 6,
  centralDuelsLost: 7,
  flankErrors: 0.6,
  centralErrors: 0.6,
  progressivePasses: 42,
  passesIntoFinalThird: 38,
  passesIntoBox: 9,
  dangerousAttacks: 50,
  centralKeyPasses: 9,
  setPieceShotsShareOfShots: 0.18,
  aerialDuelsWon: 12,
  freeKicksFinalThird: 4,
  pressuresFinalThird: 40,
  turnoversForced: 8,
  forcedLongBalls: 10,
  highRecoveries: 8,
  possessionsLostOwnHalf: 8,
  counterAttacks: 3,
  shotsAfterRecovery: 2.5,
  xgAfterRecovery: 0.3,
  directAttacks: 4,
  dribblesCompleted: 9,
  offensiveDuelsWon: 18,
  playerShareConcentration: 0.22
} as const;

function sumPlayer(
  players: PlayerProfile[] | undefined,
  positionPredicate: (position: string) => boolean,
  getter: (p: PlayerProfile) => number
): number | undefined {
  if (!players?.length) return undefined;
  const filtered = players.filter((p) => positionPredicate(p.position));
  if (!filtered.length) return undefined;
  return filtered.reduce((acc, p) => acc + (isFiniteNumber(getter(p)) ? getter(p) : 0), 0);
}

const isMidfielder = (position: string): boolean =>
  /m|c/i.test(position) && !/gk|por/i.test(position);

/* ------------------------------------------------------------------ */
/* Configurazione categorie                                            */
/* ------------------------------------------------------------------ */

type CategoryConfig = {
  id: string;
  fieldZone: FieldZone;
  useReferee?: boolean;
  strengthMetrics: MetricSpec[];
  weaknessMetrics: MetricSpec[];
};

function adv(
  label: string,
  direction: MetricDirection,
  advanced: AdvancedGetter,
  baseline: (lg: LeagueAverages) => number | undefined,
  inverse = false
): MetricSpec {
  return { label, direction, advanced, baseline, inverse };
}

function sub(
  label: string,
  direction: MetricDirection,
  subGetter: SubGetter,
  baseline: (lg: LeagueAverages) => number | undefined,
  subSource: MetricBreakdown["source"] = "season",
  inverse = false
): MetricSpec {
  return { label, direction, sub: subGetter, baseline, subSource, inverse };
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: "right_flank_mismatch",
    fieldZone: "right_flank",
    strengthMetrics: [
      sub("Sviluppo dalla fascia destra", "strength", (t) => t.attackingZones?.rightFlankAttackShare, () => HEURISTIC_BASELINES.flankAttackShare),
      sub("Cross dalla destra", "strength", (t) => t.attackingZones?.rightFlankCrosses, (lg) => lg.crossesFor * 0.4),
      sub("Progressioni dalla destra", "strength", (t) => t.attackingZones?.rightFlankProgressions, () => HEURISTIC_BASELINES.flankProgressions),
      sub("Dribbling completati a destra", "strength", (t) => t.attackingZones?.rightFlankDribblesCompleted, () => HEURISTIC_BASELINES.flankDribblesCompleted),
      sub("Azioni dalla destra con tiro", "strength", (t) => t.attackingZones?.attacksFromRightLeadingToShot, (lg) => lg.shotsFor * 0.3)
    ],
    weaknessMetrics: [
      sub("Tiri concessi a sinistra", "weakness", (t) => t.defensiveZones?.leftFlankShotsConceded, (lg) => lg.shotsAgainst * 0.3),
      sub("Cross concessi a sinistra", "weakness", (t) => t.defensiveZones?.leftFlankCrossesConceded, (lg) => lg.crossesAgainst * 0.4),
      sub("Dribbling subiti a sinistra", "weakness", (t) => t.defensiveZones?.leftFlankDribblesAllowed, () => HEURISTIC_BASELINES.flankDribblesAllowed),
      sub("Duelli persi a sinistra", "weakness", (t) => t.defensiveZones?.leftFlankDuelsLost, () => HEURISTIC_BASELINES.flankDuelsLost),
      sub("Errori sulla fascia sinistra", "weakness", (t) => t.defensiveZones?.leftFlankErrors, () => HEURISTIC_BASELINES.flankErrors)
    ]
  },
  {
    id: "left_flank_mismatch",
    fieldZone: "left_flank",
    strengthMetrics: [
      sub("Sviluppo dalla fascia sinistra", "strength", (t) => t.attackingZones?.leftFlankAttackShare, () => HEURISTIC_BASELINES.flankAttackShare),
      sub("Cross dalla sinistra", "strength", (t) => t.attackingZones?.leftFlankCrosses, (lg) => lg.crossesFor * 0.4),
      sub("Progressioni dalla sinistra", "strength", (t) => t.attackingZones?.leftFlankProgressions, () => HEURISTIC_BASELINES.flankProgressions),
      sub("Dribbling completati a sinistra", "strength", (t) => t.attackingZones?.leftFlankDribblesCompleted, () => HEURISTIC_BASELINES.flankDribblesCompleted),
      sub("Azioni dalla sinistra con tiro", "strength", (t) => t.attackingZones?.attacksFromLeftLeadingToShot, (lg) => lg.shotsFor * 0.3)
    ],
    weaknessMetrics: [
      sub("Tiri concessi a destra", "weakness", (t) => t.defensiveZones?.rightFlankShotsConceded, (lg) => lg.shotsAgainst * 0.3),
      sub("Cross concessi a destra", "weakness", (t) => t.defensiveZones?.rightFlankCrossesConceded, (lg) => lg.crossesAgainst * 0.4),
      sub("Dribbling subiti a destra", "weakness", (t) => t.defensiveZones?.rightFlankDribblesAllowed, () => HEURISTIC_BASELINES.flankDribblesAllowed),
      sub("Duelli persi a destra", "weakness", (t) => t.defensiveZones?.rightFlankDuelsLost, () => HEURISTIC_BASELINES.flankDuelsLost),
      sub("Errori sulla fascia destra", "weakness", (t) => t.defensiveZones?.rightFlankErrors, () => HEURISTIC_BASELINES.flankErrors)
    ]
  },
  {
    id: "central_creation_mismatch",
    fieldZone: "central",
    strengthMetrics: [
      sub("Sviluppo centrale", "strength", (t) => t.attackingZones?.centralAttackShare, () => HEURISTIC_BASELINES.centralAttackShare),
      sub("Progressioni centrali", "strength", (t) => t.attackingZones?.centralProgressions, () => HEURISTIC_BASELINES.centralProgressions),
      adv("Passaggi nell'ultimo terzo", "strength", (s) => s.passesIntoFinalThirdFor, () => HEURISTIC_BASELINES.passesIntoFinalThird),
      adv("Passaggi in area", "strength", (s) => s.passesIntoBoxFor, () => HEURISTIC_BASELINES.passesIntoBox),
      sub("Passaggi chiave dei centrali", "strength", (t) => sumPlayer(t.playerProfiles, isMidfielder, (p) => p.keyPasses), () => HEURISTIC_BASELINES.centralKeyPasses)
    ],
    weaknessMetrics: [
      sub("Tiri concessi centralmente", "weakness", (t) => t.defensiveZones?.centralShotsConceded, (lg) => lg.shotsAgainst * 0.4),
      sub("Duelli persi al centro", "weakness", (t) => t.defensiveZones?.centralDuelsLost, () => HEURISTIC_BASELINES.centralDuelsLost),
      sub("Errori nella zona centrale", "weakness", (t) => t.defensiveZones?.centralErrors, () => HEURISTIC_BASELINES.centralErrors),
      adv("Passaggi nell'ultimo terzo concessi", "weakness", (s) => s.passesIntoFinalThirdAgainst, () => HEURISTIC_BASELINES.passesIntoFinalThird),
      adv("Passaggi in area concessi", "weakness", (s) => s.passesIntoBoxAgainst, () => HEURISTIC_BASELINES.passesIntoBox)
    ]
  },
  {
    id: "box_presence_mismatch",
    fieldZone: "box",
    strengthMetrics: [
      adv("Tocchi in area", "strength", (s) => s.touchesInBoxFor, (lg) => lg.touchesInBoxFor),
      adv("Tiri da dentro l'area", "strength", (s) => s.shotsInsideBoxFor, (lg) => lg.shotsInsideBoxFor),
      adv("Grandi occasioni", "strength", (s) => s.bigChancesFor, (lg) => lg.bigChancesFor),
      adv("xG prodotto", "strength", (s) => s.xgFor, (lg) => lg.xgFor),
      sub("xG per tiro", "strength", (t) => t.shotProfile?.xgPerShotFor, (lg) => lg.xgPerShotFor)
    ],
    weaknessMetrics: [
      adv("Tocchi in area concessi", "weakness", (s) => s.touchesInBoxAgainst, (lg) => lg.touchesInBoxAgainst),
      adv("Tiri da dentro l'area concessi", "weakness", (s) => s.shotsInsideBoxAgainst, (lg) => lg.shotsInsideBoxAgainst),
      adv("Grandi occasioni concesse", "weakness", (s) => s.bigChancesAgainst, (lg) => lg.bigChancesAgainst),
      adv("xG concesso", "weakness", (s) => s.xgAgainst, (lg) => lg.xgAgainst),
      sub("xG per tiro concesso", "weakness", (t) => t.shotProfile?.xgPerShotAgainst, (lg) => lg.xgPerShotAgainst)
    ]
  },
  {
    id: "set_piece_mismatch",
    fieldZone: "set_pieces",
    strengthMetrics: [
      sub("Corner conquistati", "strength", (t) => t.setPieceStats?.cornersFor, (lg) => lg.cornersFor),
      sub("xG da palle inattive", "strength", (t) => t.setPieceStats?.xgFromSetPiecesFor, (lg) => lg.xgFor * 0.25),
      sub("Tiri da palle inattive", "strength", (t) => t.setPieceStats?.shotsFromSetPiecesFor, (lg) => lg.shotsFor * HEURISTIC_BASELINES.setPieceShotsShareOfShots),
      sub("Gol da palle inattive", "strength", (t) => t.setPieceStats?.goalsFromSetPiecesFor, (lg) => lg.goalsFor * 0.25),
      sub("Duelli aerei vinti", "strength", (t) => t.setPieceStats?.aerialDuelsWonFor, () => HEURISTIC_BASELINES.aerialDuelsWon),
      sub("Punizioni guadagnate in zona avanzata", "strength", (t) => t.setPieceStats?.freeKicksWonFinalThird, () => HEURISTIC_BASELINES.freeKicksFinalThird)
    ],
    weaknessMetrics: [
      sub("Corner concessi", "weakness", (t) => t.setPieceStats?.cornersAgainst, (lg) => lg.cornersAgainst),
      sub("xG concesso da palle inattive", "weakness", (t) => t.setPieceStats?.xgFromSetPiecesAgainst, (lg) => lg.xgAgainst * 0.25),
      sub("Tiri concessi da palle inattive", "weakness", (t) => t.setPieceStats?.shotsFromSetPiecesAgainst, (lg) => lg.shotsAgainst * HEURISTIC_BASELINES.setPieceShotsShareOfShots),
      sub("Gol concessi da palle inattive", "weakness", (t) => t.setPieceStats?.goalsFromSetPiecesAgainst, (lg) => lg.goalsAgainst * 0.25),
      sub("Duelli aerei persi", "weakness", (t) => t.setPieceStats?.aerialDuelsLostAgainst, () => HEURISTIC_BASELINES.aerialDuelsWon),
      sub("Punizioni concesse in zona avanzata", "weakness", (t) => t.setPieceStats?.freeKicksConcededFinalThird, () => HEURISTIC_BASELINES.freeKicksFinalThird)
    ]
  },
  {
    id: "outside_shot_mismatch",
    fieldZone: "general",
    strengthMetrics: [
      adv("Tiri da fuori area", "strength", (s) => s.shotsOutsideBoxFor, (lg) => lg.shotsOutsideBoxFor),
      sub("Precisione al tiro", "strength", (t) => t.shotProfile?.shotAccuracyFor, (lg) => safeAccuracy(lg.shotsOnTargetFor, lg.shotsFor)),
      adv("xG prodotto", "strength", (s) => s.xgFor, (lg) => lg.xgFor),
      adv("Gol realizzati", "strength", (s) => s.goalsFor, (lg) => lg.goalsFor)
    ],
    weaknessMetrics: [
      adv("Tiri da fuori area concessi", "weakness", (s) => s.shotsOutsideBoxAgainst, (lg) => lg.shotsOutsideBoxAgainst),
      adv("xG concesso", "weakness", (s) => s.xgAgainst, (lg) => lg.xgAgainst),
      sub("Precisione al tiro concessa", "weakness", (t) => t.shotProfile?.shotAccuracyAgainst, (lg) => safeAccuracy(lg.shotsOnTargetAgainst, lg.shotsAgainst)),
      adv("Gol subiti", "weakness", (s) => s.goalsAgainst, (lg) => lg.goalsAgainst)
    ]
  },
  {
    id: "shot_quality_mismatch",
    fieldZone: "box",
    strengthMetrics: [
      sub("xG per tiro", "strength", (t) => t.shotProfile?.xgPerShotFor, (lg) => lg.xgPerShotFor),
      sub("Percentuale grandi occasioni", "strength", (t) => t.shotProfile?.bigChanceRateFor, (lg) => safeAccuracy(lg.bigChancesFor, lg.shotsFor)),
      sub("Percentuale tiri da dentro l'area", "strength", (t) => t.shotProfile?.shotsInsideBoxShareFor, (lg) => safeAccuracy(lg.shotsInsideBoxFor, lg.shotsFor)),
      adv("Tiri in porta", "strength", (s) => s.shotsOnTargetFor, (lg) => lg.shotsOnTargetFor),
      adv("xG prodotto", "strength", (s) => s.xgFor, (lg) => lg.xgFor)
    ],
    weaknessMetrics: [
      sub("xG per tiro concesso", "weakness", (t) => t.shotProfile?.xgPerShotAgainst, (lg) => lg.xgPerShotAgainst),
      sub("Percentuale grandi occasioni concesse", "weakness", (t) => t.shotProfile?.bigChanceRateAgainst, (lg) => safeAccuracy(lg.bigChancesAgainst, lg.shotsAgainst)),
      sub("Percentuale tiri da dentro l'area concessi", "weakness", (t) => t.shotProfile?.shotsInsideBoxShareAgainst, (lg) => safeAccuracy(lg.shotsInsideBoxAgainst, lg.shotsAgainst)),
      adv("Tiri in porta concessi", "weakness", (s) => s.shotsOnTargetAgainst, (lg) => lg.shotsOnTargetAgainst),
      adv("xG concesso", "weakness", (s) => s.xgAgainst, (lg) => lg.xgAgainst)
    ]
  },
  {
    id: "offensive_pressure_mismatch",
    fieldZone: "general",
    strengthMetrics: [
      adv("Tiri prodotti", "strength", (s) => s.shotsFor, (lg) => lg.shotsFor),
      adv("Tiri in porta", "strength", (s) => s.shotsOnTargetFor, (lg) => lg.shotsOnTargetFor),
      adv("Tocchi in area", "strength", (s) => s.touchesInBoxFor, (lg) => lg.touchesInBoxFor),
      adv("Corner conquistati", "strength", (s) => s.cornersFor, (lg) => lg.cornersFor),
      adv("Attacchi pericolosi", "strength", (s) => s.dangerousAttacksFor, () => HEURISTIC_BASELINES.dangerousAttacks),
      adv("Passaggi nell'ultimo terzo", "strength", (s) => s.passesIntoFinalThirdFor, () => HEURISTIC_BASELINES.passesIntoFinalThird)
    ],
    weaknessMetrics: [
      adv("Tiri concessi", "weakness", (s) => s.shotsAgainst, (lg) => lg.shotsAgainst),
      adv("Tiri in porta concessi", "weakness", (s) => s.shotsOnTargetAgainst, (lg) => lg.shotsOnTargetAgainst),
      adv("Tocchi in area concessi", "weakness", (s) => s.touchesInBoxAgainst, (lg) => lg.touchesInBoxAgainst),
      adv("Corner concessi", "weakness", (s) => s.cornersAgainst, (lg) => lg.cornersAgainst),
      adv("Attacchi pericolosi concessi", "weakness", (s) => s.dangerousAttacksAgainst, () => HEURISTIC_BASELINES.dangerousAttacks),
      adv("Passaggi nell'ultimo terzo concessi", "weakness", (s) => s.passesIntoFinalThirdAgainst, () => HEURISTIC_BASELINES.passesIntoFinalThird)
    ]
  },
  {
    id: "pressing_mismatch",
    fieldZone: "transition",
    strengthMetrics: [
      sub("Intensità di pressing (PPDA)", "strength", (t) => t.pressingStats?.ppdaFor, (lg) => lg.ppdaFor, "season", true),
      sub("Recuperi alti", "strength", (t) => t.pressingStats?.highRecoveriesFor, (lg) => lg.highRecoveriesFor ?? HEURISTIC_BASELINES.highRecoveries),
      sub("Pressioni nell'ultimo terzo", "strength", (t) => t.pressingStats?.pressuresFinalThirdFor, () => HEURISTIC_BASELINES.pressuresFinalThird),
      sub("Palloni recuperati con turnover", "strength", (t) => t.pressingStats?.turnoversForcedFor, () => HEURISTIC_BASELINES.turnoversForced),
      sub("Lanci lunghi forzati", "strength", (t) => t.pressingStats?.forcedLongBallsFor, () => HEURISTIC_BASELINES.forcedLongBalls)
    ],
    weaknessMetrics: [
      sub("Pressabilità (PPDA concesso)", "weakness", (t) => t.pressingStats?.ppdaAgainst, (lg) => lg.ppdaAgainst, "season", true),
      sub("Palloni persi nella propria metà", "weakness", (t) => t.transitionStats?.possessionsLostInOwnHalf, () => HEURISTIC_BASELINES.possessionsLostOwnHalf),
      sub("Lanci lunghi subiti", "weakness", (t) => t.pressingStats?.forcedLongBallsAgainst, () => HEURISTIC_BASELINES.forcedLongBalls),
      sub("Turnover subiti", "weakness", (t) => t.pressingStats?.turnoversForcedAgainst, () => HEURISTIC_BASELINES.turnoversForced)
    ]
  },
  {
    id: "transition_mismatch",
    fieldZone: "transition",
    strengthMetrics: [
      sub("Ripartenze", "strength", (t) => t.transitionStats?.counterAttacksFor, (lg) => lg.counterAttacksFor ?? HEURISTIC_BASELINES.counterAttacks),
      sub("Tiri dopo recupero", "strength", (t) => t.transitionStats?.shotsAfterRecoveryFor, () => HEURISTIC_BASELINES.shotsAfterRecovery),
      sub("xG dopo recupero", "strength", (t) => t.transitionStats?.xgAfterRecoveryFor, () => HEURISTIC_BASELINES.xgAfterRecovery),
      sub("Attacchi diretti", "strength", (t) => t.transitionStats?.directAttacksFor, () => HEURISTIC_BASELINES.directAttacks)
    ],
    weaknessMetrics: [
      sub("Ripartenze concesse", "weakness", (t) => t.transitionStats?.counterAttacksAgainst, (lg) => lg.counterAttacksAgainst ?? HEURISTIC_BASELINES.counterAttacks),
      sub("Tiri concessi dopo recupero", "weakness", (t) => t.transitionStats?.shotsAfterRecoveryAgainst, () => HEURISTIC_BASELINES.shotsAfterRecovery),
      sub("xG concesso dopo recupero", "weakness", (t) => t.transitionStats?.xgAfterRecoveryAgainst, () => HEURISTIC_BASELINES.xgAfterRecovery),
      sub("Attacchi diretti concessi", "weakness", (t) => t.transitionStats?.directAttacksAgainst, () => HEURISTIC_BASELINES.directAttacks),
      sub("Palloni persi nella propria metà", "weakness", (t) => t.transitionStats?.possessionsLostInOwnHalf, () => HEURISTIC_BASELINES.possessionsLostOwnHalf)
    ]
  },
  {
    id: "discipline_contacts_mismatch",
    fieldZone: "discipline",
    useReferee: true,
    strengthMetrics: [
      adv("Falli subiti", "strength", (s) => s.foulsSuffered, (lg) => lg.foulsSuffered),
      sub("Falli subiti in zona avanzata", "strength", (t) => t.disciplineStats?.foulsSufferedFinalThird, (lg) => lg.foulsSuffered * 0.3),
      sub("Dribbling completati", "strength", (t) => t.duelStats?.dribblesCompleted, () => HEURISTIC_BASELINES.dribblesCompleted),
      sub("Duelli offensivi vinti", "strength", (t) => t.duelStats?.offensiveDuelsWon, () => HEURISTIC_BASELINES.offensiveDuelsWon)
    ],
    weaknessMetrics: [
      adv("Falli commessi", "weakness", (s) => s.foulsCommitted, (lg) => lg.foulsCommitted),
      sub("Falli commessi nella propria metà", "weakness", (t) => t.disciplineStats?.foulsCommittedDefensiveThird, (lg) => lg.foulsCommitted * 0.3),
      adv("Cartellini gialli", "weakness", (s) => s.yellowCards, (lg) => lg.yellowCards),
      sub("Cartellini ai difensori", "weakness", (t) => t.disciplineStats?.cardsForDefenders, (lg) => lg.yellowCards * 0.4)
    ]
  }
];

function safeAccuracy(part: number, total: number): number | undefined {
  if (!isFiniteNumber(part) || !isFiniteNumber(total) || total <= 0) return undefined;
  return part / total;
}

/* ------------------------------------------------------------------ */
/* Strutture intermedie                                                */
/* ------------------------------------------------------------------ */

type Intermediate = {
  category: string;
  fieldZone: FieldZone;
  useReferee: boolean;
  team: string;
  opponent: string;
  attacker: TeamProfile;
  defender: TeamProfile;
  attackerIsHome: boolean;
  strengthScore: number;
  weaknessScore: number;
  keyMetrics: MetricBreakdown[];
  warnings: string[];
};

function evaluateCategory(
  config: CategoryConfig,
  attacker: TeamProfile,
  defender: TeamProfile,
  attackerIsHome: boolean,
  lg: LeagueAverages
): Intermediate | null {
  const strengthMetrics: MetricBreakdown[] = [];
  for (const spec of config.strengthMetrics) {
    const breakdown = evaluateMetric(spec, attacker, attackerIsHome, lg);
    if (breakdown) strengthMetrics.push(breakdown);
  }

  const weaknessMetrics: MetricBreakdown[] = [];
  for (const spec of config.weaknessMetrics) {
    const breakdown = evaluateMetric(spec, defender, !attackerIsHome, lg);
    if (breakdown) weaknessMetrics.push(breakdown);
  }

  if (strengthMetrics.length < 2 || weaknessMetrics.length < 2) return null;

  const keyMetrics = [...strengthMetrics, ...weaknessMetrics];
  return {
    category: config.id,
    fieldZone: config.fieldZone,
    useReferee: Boolean(config.useReferee),
    team: attacker.teamName,
    opponent: defender.teamName,
    attacker,
    defender,
    attackerIsHome,
    strengthScore: calculateStrengthScore(keyMetrics),
    weaknessScore: calculateWeaknessScore(keyMetrics),
    keyMetrics,
    warnings: []
  };
}

/* ------------------------------------------------------------------ */
/* Dipendenza da giocatori chiave                                      */
/* ------------------------------------------------------------------ */

function evaluatePlayerDependency(
  attacker: TeamProfile,
  defender: TeamProfile,
  attackerIsHome: boolean
): Intermediate | null {
  const players = attacker.playerProfiles;
  if (!players?.length) return null;

  let keyPlayer: PlayerProfile | undefined;
  let maxShare = 0;
  for (const player of players) {
    const share = Math.max(
      isFiniteNumber(player.teamXgShare) ? player.teamXgShare : 0,
      isFiniteNumber(player.teamShotShare) ? player.teamShotShare : 0,
      isFiniteNumber(player.teamChanceCreationShare) ? player.teamChanceCreationShare : 0
    );
    if (share > maxShare) {
      maxShare = share;
      keyPlayer = player;
    }
  }

  if (!keyPlayer || maxShare <= 0) return null;

  const base = HEURISTIC_BASELINES.playerShareConcentration;
  const buildShare = (label: string, value: number): MetricBreakdown | null => {
    if (!isFiniteNumber(value) || value <= 0) return null;
    const normalized = normalizeStat(value, base);
    if (normalized == null) return null;
    return buildMetricBreakdown({
      metric: label,
      value,
      leagueAverage: base,
      normalized,
      score: normalizedToScore(normalized),
      direction: "strength",
      source: "lineup"
    });
  };

  const metrics = [
    buildShare(`Percentuale xG di ${keyPlayer.playerName}`, keyPlayer.teamXgShare),
    buildShare(`Percentuale tiri di ${keyPlayer.playerName}`, keyPlayer.teamShotShare),
    buildShare(`Percentuale creazione occasioni di ${keyPlayer.playerName}`, keyPlayer.teamChanceCreationShare)
  ].filter((m): m is MetricBreakdown => m !== null);

  if (metrics.length < 2) return null;

  const dependencyScore = calculateStrengthScore(metrics);
  const warnings: string[] = [];
  if (!keyPlayer.isAvailable) {
    warnings.push(
      `Assenza rilevante: ${keyPlayer.playerName} pesa molto nella produzione offensiva di ${attacker.teamName}.`
    );
  } else if (!keyPlayer.isExpectedStarter) {
    warnings.push(
      `${keyPlayer.playerName} non risulta tra i titolari previsti pur pesando molto nella produzione offensiva di ${attacker.teamName}.`
    );
  }

  return {
    category: "player_dependency_mismatch",
    fieldZone: "general",
    useReferee: false,
    team: attacker.teamName,
    opponent: defender.teamName,
    attacker,
    defender,
    attackerIsHome,
    strengthScore: dependencyScore,
    weaknessScore: dependencyScore,
    keyMetrics: metrics,
    warnings
  };
}

/* ------------------------------------------------------------------ */
/* Impatto formazioni e assenze                                        */
/* ------------------------------------------------------------------ */

const isDefender = (position: string): boolean => /d|cb|lb|rb|dc|td|ts/i.test(position) && !/gk|por/i.test(position);
const isAttackerRole = (position: string): boolean => /f|w|st|att|pc|cf/i.test(position);

function defenderQuality(player: PlayerProfile): "forte" | "debole" {
  const total = player.duelsWon + player.duelsLost;
  if (total <= 0) return "debole";
  return player.duelsWon / total >= 0.55 ? "forte" : "debole";
}

function evaluateLineupImpact(
  team: TeamProfile,
  opponent: TeamProfile,
  teamIsHome: boolean
): Intermediate | null {
  const absences = team.confirmedLineup?.keyAbsences ?? team.expectedLineup?.keyAbsences ?? [];
  if (!absences.length) return null;

  let impactWeight = 0;
  const warnings: string[] = [];
  for (const player of absences) {
    const offensiveWeight =
      (isFiniteNumber(player.teamXgShare) ? player.teamXgShare : 0) +
      (isFiniteNumber(player.teamChanceCreationShare) ? player.teamChanceCreationShare : 0);
    impactWeight += offensiveWeight > 0 ? offensiveWeight : 0.12;
    warnings.push(`Assenza ${player.playerName} (${player.position}) nella formazione di ${team.teamName}.`);
  }

  const normalized = normalizeStat(impactWeight, 0.25);
  if (normalized == null) return null;
  const score = normalizedToScore(normalized);

  const metric = buildMetricBreakdown({
    metric: "Peso offensivo delle assenze",
    value: impactWeight,
    leagueAverage: 0.25,
    normalized,
    score,
    direction: "strength",
    source: "lineup"
  });

  return {
    category: "lineup_impact_mismatch",
    fieldZone: "general",
    useReferee: false,
    team: team.teamName,
    opponent: opponent.teamName,
    attacker: team,
    defender: opponent,
    attackerIsHome: teamIsHome,
    strengthScore: score,
    weaknessScore: score,
    keyMetrics: [metric],
    warnings
  };
}

/**
 * applyLineupAdjustments — modifica gli score delle categorie in base alle
 * assenze chiave: riduce la forza offensiva della squadra che perde un
 * attaccante di riferimento, e corregge la debolezza dell'avversaria a
 * seconda della qualità del difensore assente.
 */
function applyLineupAdjustments(intermediates: Intermediate[]): void {
  for (const item of intermediates) {
    if (item.category === "lineup_impact_mismatch" || item.category === "player_dependency_mismatch") {
      continue;
    }

    const attackerAbsences =
      item.attacker.confirmedLineup?.keyAbsences ?? item.attacker.expectedLineup?.keyAbsences ?? [];
    const defenderAbsences =
      item.defender.confirmedLineup?.keyAbsences ?? item.defender.expectedLineup?.keyAbsences ?? [];

    for (const player of attackerAbsences) {
      if (isAttackerRole(player.position) || isMidfielder(player.position)) {
        const weight = isFiniteNumber(player.teamXgShare) ? clamp(player.teamXgShare, 0, 0.5) : 0.1;
        const reduction = clamp(0.05 + weight * 0.3, 0.05, 0.2);
        item.strengthScore = clamp(item.strengthScore * (1 - reduction), 0, 100);
        item.warnings.push(
          `Forza offensiva ridotta per l'assenza di ${player.playerName} in ${item.team}.`
        );
      }
    }

    for (const player of defenderAbsences) {
      if (!isDefender(player.position)) continue;
      const quality = defenderQuality(player);
      if (quality === "forte") {
        item.weaknessScore = clamp(item.weaknessScore * 1.1, 0, 100);
        item.warnings.push(
          `Maggiore vulnerabilità di ${item.opponent} per l'assenza del difensore ${player.playerName}.`
        );
      } else {
        item.weaknessScore = clamp(item.weaknessScore * 0.92, 0, 100);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Reliability di contesto                                             */
/* ------------------------------------------------------------------ */

function hasFullAdvanced(team: TeamProfile): boolean {
  return Boolean(
    team.attackingZones &&
      team.defensiveZones &&
      team.setPieceStats &&
      team.transitionStats &&
      team.pressingStats &&
      team.duelStats &&
      team.shotProfile
  );
}

function lineupStatus(home: TeamProfile, away: TeamProfile): LineupStatus {
  if (home.confirmedLineup && away.confirmedLineup) return "confirmed";
  if (
    (home.confirmedLineup ?? home.expectedLineup) &&
    (away.confirmedLineup ?? away.expectedLineup)
  ) {
    return "expected";
  }
  return "none";
}

/* ------------------------------------------------------------------ */
/* Deduplica insight simili                                            */
/* ------------------------------------------------------------------ */

const SIMILARITY_GROUP: Record<string, string> = {
  box_presence_mismatch: "offensive_volume",
  shot_quality_mismatch: "offensive_volume",
  offensive_pressure_mismatch: "offensive_volume"
};

export function deduplicateSimilarInsights(results: CategoryResult[]): CategoryResult[] {
  const sorted = [...results].sort((a, b) => b.finalMismatchScore - a.finalMismatchScore);
  const seen = new Set<string>();
  const kept: CategoryResult[] = [];
  for (const result of sorted) {
    const group = SIMILARITY_GROUP[result.category] ?? result.category;
    const key = `${result.team}::${group}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(result);
  }
  return kept;
}

/* ------------------------------------------------------------------ */
/* Finalizzazione insight                                              */
/* ------------------------------------------------------------------ */

function finalizeCategory(
  item: Intermediate,
  reliabilityBase: { sampleFactor: number; dataQualityFactor: number; lineupFactor: number },
  refereeFactor: number,
  applyReliabilityToScore: boolean
): CategoryResult {
  const reliabilityFactor = calculateReliabilityFactor({
    sampleFactor: reliabilityBase.sampleFactor,
    dataQualityFactor: reliabilityBase.dataQualityFactor,
    lineupFactor: reliabilityBase.lineupFactor,
    refereeFactor: item.useReferee ? refereeFactor : undefined
  });

  const mismatch = calculateMismatchScore(
    item.strengthScore,
    item.weaknessScore,
    applyReliabilityToScore ? reliabilityFactor : 1
  );

  return {
    category: item.category,
    team: item.team,
    opponent: item.opponent,
    strengthScore: round(item.strengthScore, 1),
    weaknessScore: round(item.weaknessScore, 1),
    rawMismatchScore: mismatch.raw,
    finalMismatchScore: mismatch.final,
    reliabilityFactor,
    confidence: calculateConfidence(reliabilityFactor),
    level: calculateLevel(mismatch.final),
    fieldZone: item.fieldZone,
    keyMetrics: item.keyMetrics,
    warnings: item.warnings
  };
}

function toFieldInsight(result: CategoryResult, index: number): FieldInsight {
  const text = buildInsightText(result);
  const insight: FieldInsight = {
    id: `${result.category}_${index + 1}`,
    category: result.category,
    title: text.title,
    team: result.team,
    opponent: result.opponent,
    fieldZone: result.fieldZone,
    mismatchScore: result.finalMismatchScore,
    level: result.level,
    confidence: result.confidence,
    tacticalMeaning: text.tacticalMeaning,
    summary: text.summary,
    evidence: buildEvidence(result),
    keyStats: buildKeyStats(result),
    warnings: result.warnings.length ? result.warnings : undefined
  };
  return insight;
}

/* ------------------------------------------------------------------ */
/* API pubblica                                                        */
/* ------------------------------------------------------------------ */

export function generateFieldAnalysis(
  params: GenerateFieldAnalysisParams
): FieldAnalysisResult {
  const { matchContext, homeTeam, awayTeam, leagueAverages, options } = params;

  const minMismatchScore = options?.minMismatchScore ?? MIN_MISMATCH_SCORE;
  const maxInsights = options?.maxInsights ?? MAX_INSIGHTS;
  const applyReliabilityToScore = options?.applyReliabilityToScore ?? true;

  const intermediates: Intermediate[] = [];

  for (const config of CATEGORIES) {
    const homeAttack = evaluateCategory(config, homeTeam, awayTeam, true, leagueAverages);
    if (homeAttack) intermediates.push(homeAttack);
    const awayAttack = evaluateCategory(config, awayTeam, homeTeam, false, leagueAverages);
    if (awayAttack) intermediates.push(awayAttack);
  }

  const homeDependency = evaluatePlayerDependency(homeTeam, awayTeam, true);
  if (homeDependency) intermediates.push(homeDependency);
  const awayDependency = evaluatePlayerDependency(awayTeam, homeTeam, false);
  if (awayDependency) intermediates.push(awayDependency);

  const homeLineup = evaluateLineupImpact(homeTeam, awayTeam, true);
  if (homeLineup) intermediates.push(homeLineup);
  const awayLineup = evaluateLineupImpact(awayTeam, homeTeam, false);
  if (awayLineup) intermediates.push(awayLineup);

  applyLineupAdjustments(intermediates);

  const sampleFactor = calculateSampleFactor(
    Math.min(
      homeTeam.seasonStats?.matchesPlayed ?? 0,
      awayTeam.seasonStats?.matchesPlayed ?? 0
    )
  );
  const dataQualityFactor =
    options?.dataQualityOverride != null
      ? clamp(options.dataQualityOverride, 0, 1)
      : calculateDataQualityFactor({
          hasAdvancedComplete: hasFullAdvanced(homeTeam) && hasFullAdvanced(awayTeam),
          hasXg:
            isFiniteNumber(homeTeam.seasonStats?.xgFor) && isFiniteNumber(awayTeam.seasonStats?.xgFor),
          hasZones: Boolean(
            homeTeam.attackingZones && homeTeam.defensiveZones && awayTeam.attackingZones && awayTeam.defensiveZones
          ),
          hasPlayerData: Boolean(homeTeam.playerProfiles?.length && awayTeam.playerProfiles?.length),
          hasTeamStats: Boolean(homeTeam.seasonStats && awayTeam.seasonStats)
        });
  const lineupFactor = calculateLineupFactor(lineupStatus(homeTeam, awayTeam));
  const refereeFactor = calculateRefereeFactor(Boolean(matchContext.referee));

  const reliabilityBase = { sampleFactor, dataQualityFactor, lineupFactor };

  const allResults = intermediates.map((item) =>
    finalizeCategory(item, reliabilityBase, refereeFactor, applyReliabilityToScore)
  );

  const aboveThreshold = allResults.filter(
    (r) => r.finalMismatchScore >= minMismatchScore
  );

  const deduped = deduplicateSimilarInsights(aboveThreshold);

  const topResults = deduped
    .sort((a, b) => b.finalMismatchScore - a.finalMismatchScore)
    .slice(0, maxInsights);

  const insights = topResults.map((result, index) => toFieldInsight(result, index));

  const globalSummary = sanitizeText(
    buildGlobalSummary(
      homeTeam.teamName,
      awayTeam.teamName,
      topResults.map((r) => ({ title: buildInsightText(r).title, team: r.team }))
    )
  );

  return {
    matchId: matchContext.matchId,
    generatedAt: new Date().toISOString(),
    homeTeam: homeTeam.teamName,
    awayTeam: awayTeam.teamName,
    globalSummary,
    insights
  };
}

/**
 * sanitizeText — guardia di sicurezza: se per qualunque motivo un testo
 * contenesse una parola vietata, la rimuove mantenendo la frase leggibile.
 * In condizioni normali i template non producono parole vietate.
 */
function sanitizeText(text: string): string {
  const forbidden = findForbiddenWords(text);
  if (!forbidden.length) return text;
  let cleaned = text;
  for (const word of forbidden) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .replace(new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "giu"), "$1$2")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return cleaned;
}

export { findForbiddenWords } from "./fieldAnalysis.text";
