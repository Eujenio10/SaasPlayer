import {
  averagePositionCompatibilityScore,
  heatmapOverlap,
  heatmapQualityFromPointCount,
  overlapGridFromLayers
} from "@/lib/difficult-markings/heatmap";
import {
  buildPercentileLookup,
  redistributeWeightedScore,
  sampleSizeScore,
  type PercentilePoolEntry
} from "@/lib/difficult-markings/percentiles";
import { buildReasonsForMatchup } from "@/lib/difficult-markings/reasons";
import {
  clamp,
  percentileGroupForRole,
  profileActsAsDefender,
  profileIsMarkingCoverTarget,
  coverPairAllowed,
  heatmapOccupiesAttackingThird,
  COVER_HEATMAP_MIN_OVERLAP_PCT,
  roleCompatibilityScore,
  rolesAreCompatible,
  roleLabelIt
} from "@/lib/difficult-markings/roles";
import type {
  DifficultMarkingLevel,
  DifficultMarkingMatchup,
  PlayerRecentProfile,
  ProbableZone
} from "@/lib/difficult-markings/types";
import type { UpcomingMatchItem } from "@/services/sportapi";
import {
  attackerMarkingDifficultyIndex,
  defensiveDifficultyScore,
  difficultyScoreAgainstMatchMax,
  offensiveThreatBreakdown,
  zonePressureContribution,
  zonePressureLabelIt
} from "@/lib/difficult-markings/attacker-threat";
import { MARKING_THREAT_CONFIG } from "@/lib/difficult-markings/threat-config";

const MATCHUP_THRESHOLD = 0.52;
const MIN_FOULS_SUFFERED_TO_COVER = 1;
const MIN_MARKING_LOAD = 2;
const DUAL_LOAD_MIN_OVERLAP_PCT = COVER_HEATMAP_MIN_OVERLAP_PCT;
/** Massimo 3 attaccanti coperti dallo stesso marcatore (1 principale + 2 extra). */
const MAX_MARKING_ATTACKERS = 3;
/** Falli subiti/90 che valgono 100 sul componente falli (poi media con overlap 0–100). */
const FOULS_DRAWN_SCORE_REF = 2;

/** Indice 0–100: media tra % overlap heatmap e falli subiti (normalizzati) dei marcati. */
export function foulsOverlapMarkingScore(overlapPct: number, foulsDrawnPer90: number): number {
  const overlapScore = clamp(overlapPct, 0, 100);
  const foulsScore = clamp((foulsDrawnPer90 / FOULS_DRAWN_SCORE_REF) * 100, 0, 100);
  return Math.round((overlapScore + foulsScore) / 2);
}

/** Falli/90 e dribbling riusciti/90 che valgono 100 sul 1 vs 1 di ruolo. */
const FOULS_DRIBBLES_SCORE_REF = 2.6;

/** Indice 0–100: media tra falli subiti e dribbling riusciti dell’attaccante. */
export function foulsDribblesMarkingScore(foulsDrawnPer90: number, dribblesSuccessfulPer90: number): number {
  const foulsScore = clamp((foulsDrawnPer90 / FOULS_DRIBBLES_SCORE_REF) * 100, 0, 100);
  const dribbleScore = clamp((dribblesSuccessfulPer90 / FOULS_DRIBBLES_SCORE_REF) * 100, 0, 100);
  return Math.round((foulsScore + dribbleScore) / 2);
}

export function clusterFoulsOverlapScore(
  items: Array<{ heatmapOverlapPct: number; foulsDrawnPer90: number }>
): number {
  if (!items.length) return 0;
  const meanOverlap = items.reduce((sum, item) => sum + item.heatmapOverlapPct, 0) / items.length;
  const meanFouls = items.reduce((sum, item) => sum + item.foulsDrawnPer90, 0) / items.length;
  return foulsOverlapMarkingScore(meanOverlap, meanFouls);
}

function formationPositionScore(attacker: PlayerRecentProfile, defender: PlayerRecentProfile): number {
  if (attacker.formationSide !== "center" && defender.formationSide !== "center") {
    if (attacker.formationSide === "left" && defender.formationSide === "right") return 0.92;
    if (attacker.formationSide === "right" && defender.formationSide === "left") return 0.92;
    return 0.35;
  }
  if (attacker.formationSide === "center" && defender.formationSide === "center") return 0.78;
  return 0.55;
}

function resolveProbableZone(
  overlap: number,
  attacker: PlayerRecentProfile,
  defender: PlayerRecentProfile
): ProbableZone {
  if (overlap >= 0.72) {
    if (attacker.formationSide === "left") return "left_flank";
    if (attacker.formationSide === "right") return "right_flank";
    return "central";
  }
  if (attacker.formationSide === "left") return overlap >= 0.45 ? "half_space_left" : "left_flank";
  if (attacker.formationSide === "right") return overlap >= 0.45 ? "half_space_right" : "right_flank";
  if (defender.normalizedRole.startsWith("CB_")) return overlap >= 0.5 ? "penalty_area" : "central";
  return "unknown";
}

function zoneLabelIt(zone: ProbableZone): string {
  const map: Record<ProbableZone, string> = {
    left_flank: "Fascia sinistra",
    right_flank: "Fascia destra",
    central: "Centrale",
    half_space_left: "Half-space sinistro",
    half_space_right: "Half-space destro",
    penalty_area: "Area di rigore",
    unknown: "Zona stimata"
  };
  return map[zone];
}

export function difficultMarkingLevelFromScore(score: number): DifficultMarkingLevel {
  if (score >= 85) return "extremely_difficult";
  if (score >= 75) return "very_difficult";
  if (score >= 65) return "difficult";
  if (score >= 55) return "monitor";
  return "hidden";
}

export function difficultMarkingLevelLabelIt(level: DifficultMarkingLevel): string {
  const map: Record<DifficultMarkingLevel, string> = {
    extremely_difficult: "Estremamente difficile",
    very_difficult: "Molto difficile",
    difficult: "Difficile",
    monitor: "Da monitorare",
    hidden: "Non pubblicato"
  };
  return map[level];
}

export function calibrateDifficultMarkingScore(rawScore: number, competitionId?: string): number {
  void competitionId;
  return clamp(rawScore, 0, 1);
}

function lineupConfidenceScore(attacker: PlayerRecentProfile, defender: PlayerRecentProfile): number {
  const minutesFactor = clamp(
    Math.min(attacker.expectedMinutes, defender.expectedMinutes) / 75,
    0,
    1
  );
  return attacker.startProbability * defender.startProbability * minutesFactor;
}

function reliabilityScore(params: {
  attacker: PlayerRecentProfile;
  defender: PlayerRecentProfile;
  lineupConfidence: number;
  usedHeatmap: boolean;
  percentileGroupSize: number;
}): number {
  const sampleScore =
    (sampleSizeScore(params.attacker.sampleMatches, params.attacker.sampleMinutes) +
      sampleSizeScore(params.defender.sampleMatches, params.defender.sampleMinutes)) /
    2;
  const roleStability = (params.attacker.roleStability + params.defender.roleStability) / 2;
  const completeness = (params.attacker.dataCompleteness + params.defender.dataCompleteness) / 2;
  const heatmapQuality = params.usedHeatmap
    ? (heatmapQualityFromPointCount(params.attacker.heatmapPointCount) +
        heatmapQualityFromPointCount(params.defender.heatmapPointCount)) /
      2
    : 0.25;
  const percentilePenalty = params.percentileGroupSize >= 6 ? 1 : params.percentileGroupSize >= 4 ? 0.82 : 0.62;

  return clamp(
    (0.25 * sampleScore +
      0.2 * roleStability +
      0.2 * completeness +
      0.2 * params.lineupConfidence +
      0.15 * heatmapQuality) *
      percentilePenalty,
    0,
    1
  );
}

function computeMatchupScore(params: {
  attacker: PlayerRecentProfile;
  defender: PlayerRecentProfile;
  usedHeatmap: boolean;
  overlap: number;
}): number {
  const roleScore = roleCompatibilityScore(params.attacker.normalizedRole, params.defender.normalizedRole);
  const formationScore = formationPositionScore(params.attacker, params.defender);

  if (params.usedHeatmap) {
    const overlapWeight = roleScore >= 0.55 ? 0.5 : 0.62;
    const roleWeight = roleScore >= 0.55 ? 0.3 : 0.2;
    const formationWeight = 1 - overlapWeight - roleWeight;
    return clamp(
      overlapWeight * params.overlap + roleWeight * roleScore + formationWeight * formationScore,
      0,
      1
    );
  }

  const avgPosScore = averagePositionCompatibilityScore(
    params.attacker.averagePosition,
    params.defender.averagePosition
  );
  return clamp(0.5 * roleScore + 0.32 * formationScore + 0.18 * avgPosScore, 0, 0.82);
}

function computeAttackerMarkingThreat(
  attacker: PlayerRecentProfile,
  lookup: ReturnType<typeof buildPercentileLookup>,
  percentilePoolSize: number
): { score: number | null; metrics: Record<string, number | null> } {
  const percentileResult = computeAttackerChallengeScore(attacker, lookup);
  const absolute = absoluteAttackerChallengeScore(attacker);

  let score: number | null = absolute;
  if (absolute != null && percentileResult.score != null && percentilePoolSize >= 10) {
    score = 0.78 * absolute + 0.22 * percentileResult.score;
  } else if (absolute == null) {
    score = percentileResult.score;
  }

  return { score, metrics: percentileResult.metrics };
}

function computeAttackerChallengeScore(
  attacker: PlayerRecentProfile,
  lookup: ReturnType<typeof buildPercentileLookup>
): { score: number | null; metrics: Record<string, number | null> } {
  const group = percentileGroupForRole(attacker.normalizedRole);
  const foulsDrawn = lookup.get("foulsDrawnPer90", group, attacker.foulsDrawnPer90);
  const dribblesAttempted = lookup.get("dribblesAttemptedPer90", group, attacker.dribblesAttemptedPer90);
  const dribblesSuccessful = lookup.get("dribblesSuccessfulPer90", group, attacker.dribblesSuccessfulPer90);
  const duelsWon = lookup.get("duelsWonPer90", group, attacker.duelsWonPer90);

  const { score } = redistributeWeightedScore([
    { weight: 0.5, value: foulsDrawn },
    { weight: 0.3, value: dribblesSuccessful },
    { weight: 0.2, value: dribblesAttempted }
  ]);

  return {
    score,
    metrics: {
      foulsDrawnPercentile: foulsDrawn,
      dribblesAttemptedPercentile: dribblesAttempted,
      dribblesSuccessfulPercentile: dribblesSuccessful,
      duelsWonPercentile: duelsWon,
      foulsDrawnPer90: attacker.foulsDrawnPer90 ?? null,
      dribblesAttemptedPer90: attacker.dribblesAttemptedPer90 ?? null,
      dribblesSuccessfulPer90: attacker.dribblesSuccessfulPer90 ?? null
    }
  };
}

function computeDefenderVulnerabilityScore(
  defender: PlayerRecentProfile,
  lookup: ReturnType<typeof buildPercentileLookup>
): { score: number | null; metrics: Record<string, number | null> } {
  const group = percentileGroupForRole(defender.normalizedRole);
  const foulsCommitted = lookup.get("foulsCommittedPer90", group, defender.foulsCommittedPer90);
  const yellowCardRate = lookup.get("yellowCardMatchRate", group, defender.yellowCardMatchRate);
  const defensiveDuelsLost = lookup.get("defensiveDuelsLostPer90", group, null);

  const { score } = redistributeWeightedScore([
    { weight: defensiveDuelsLost != null ? 0.4 : 0.45, value: foulsCommitted },
    { weight: defensiveDuelsLost != null ? 0.35 : 0.4, value: yellowCardRate },
    { weight: 0.15, value: defensiveDuelsLost },
    { weight: 0.1, value: null }
  ]);

  return {
    score,
    metrics: {
      foulsCommittedPercentile: foulsCommitted,
      yellowCardMatchRatePercentile: yellowCardRate,
      defensiveDuelsLostPercentile: defensiveDuelsLost,
      foulsCommittedPer90: defender.foulsCommittedPer90 ?? null,
      yellowCardMatchRate: defender.yellowCardMatchRate ?? null
    }
  };
}

function buildPercentileEntries(profiles: PlayerRecentProfile[]): PercentilePoolEntry[] {
  return profiles.map((p) => ({
    group: percentileGroupForRole(p.normalizedRole),
    values: {
      foulsDrawnPer90: p.foulsDrawnPer90 ?? NaN,
      dribblesAttemptedPer90: p.dribblesAttemptedPer90 ?? NaN,
      dribblesSuccessfulPer90: p.dribblesSuccessfulPer90 ?? NaN,
      duelsWonPer90: p.duelsWonPer90 ?? NaN,
      foulsCommittedPer90: p.foulsCommittedPer90 ?? NaN,
      yellowCardMatchRate: p.yellowCardMatchRate ?? NaN
    }
  }));
}

function absoluteAttackerChallengeScore(attacker: PlayerRecentProfile): number | null {
  const fouls = attacker.foulsDrawnPer90;
  const dribblesOk = attacker.dribblesSuccessfulPer90;
  const dribblesAtt = attacker.dribblesAttemptedPer90;
  if (fouls == null && dribblesOk == null && dribblesAtt == null) return null;
  return attackerMarkingDifficultyIndex(attacker);
}

function absoluteDefenderVulnerabilityScore(defender: PlayerRecentProfile): number | null {
  const { score } = redistributeWeightedScore([
    {
      weight: 0.45,
      value:
        defender.foulsCommittedPer90 != null
          ? clamp(defender.foulsCommittedPer90 / 2.4, 0, 1)
          : null
    },
    {
      weight: 0.4,
      value:
        defender.yellowCardMatchRate != null
          ? clamp(defender.yellowCardMatchRate / 0.45, 0, 1)
          : null
    },
    { weight: 0.15, value: null }
  ]);
  return score;
}

export function buildMatchupId(fixtureId: string, defenderId: string, attackerId: string): string {
  return `${fixtureId}-${defenderId}-${attackerId}`;
}

/**
 * Per ogni difensore: matchup di ruolo + pressione di zona dalla heatmap.
 *
 * Individual Threat = 0.6 × dribbling riusciti + 0.4 × falli subiti (0–100).
 * Zone Pressure = Σ (Threat × presenza heatmap) degli offensivi nella zona.
 * Difficulty =
 *   0.5 × PrimaryThreat + 0.3 × ZonePressureNorm + 0.2 × SecondaryThreat
 *
 * Pesi in MARKING_THREAT_CONFIG.
 */
export function computeDifficultMarkingsForMatch(params: {
  match: UpcomingMatchItem;
  profiles: PlayerRecentProfile[];
  percentilePool: PlayerRecentProfile[];
  competitionId: string;
  roundKey: string;
  officialLineupsUsed?: boolean;
  generatedAt?: string;
}): DifficultMarkingMatchup[] {
  const lookup = buildPercentileLookup(buildPercentileEntries(params.percentilePool));
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const fixtureId = String(params.match.eventId);
  const percentilePoolSize = params.percentilePool.length;
  const zoneMin = MARKING_THREAT_CONFIG.zonePresenceMin;

  const defenders = params.profiles.filter((p) => profileActsAsDefender(p));
  const coverTargets = params.profiles.filter((p) => profileIsMarkingCoverTarget(p));

  type ZoneOccupant = {
    attacker: PlayerRecentProfile;
    overlap: number;
    threat: ReturnType<typeof offensiveThreatBreakdown>;
    roleScore: number;
    attackerGrid: number[];
    attackerPoints: NonNullable<PlayerRecentProfile["heatmapPointsMatchFrame"]>;
  };

  type DefenderDraft = {
    defender: PlayerRecentProfile;
    defenderGrid: number[];
    defenderPoints: NonNullable<PlayerRecentProfile["heatmapPointsMatchFrame"]>;
    occupants: ZoneOccupant[];
  };

  const drafts: DefenderDraft[] = [];

  for (const defender of defenders) {
    const defenderPoints = defender.heatmapPointsMatchFrame;
    const clashDefender = defender.offensiveHeatmap ?? defender.defensiveHeatmap;
    if (!defenderPoints || defenderPoints.length < 3 || !clashDefender?.length) continue;

    const occupants: ZoneOccupant[] = [];
    for (const attacker of coverTargets) {
      if (defender.teamId === attacker.teamId) continue;
      if (defender.playerId === attacker.playerId) continue;
      const attackerPoints = attacker.heatmapPointsMatchFrame;
      const clashAttacker = attacker.offensiveHeatmap;
      if (!attackerPoints || attackerPoints.length < 3 || !clashAttacker?.length) continue;

      const overlap = heatmapOverlap(clashAttacker, clashDefender);
      if (overlap < zoneMin) continue;
      if (!coverPairAllowed(attacker.normalizedRole, defender.normalizedRole, overlap)) continue;

      const threat = offensiveThreatBreakdown(attacker);
      if (threat.threat100 <= 0) continue;

      occupants.push({
        attacker,
        overlap,
        threat,
        roleScore: roleCompatibilityScore(attacker.normalizedRole, defender.normalizedRole),
        attackerGrid: clashAttacker,
        attackerPoints
      });
    }

    if (!occupants.length) continue;
    drafts.push({
      defender,
      defenderGrid: clashDefender,
      defenderPoints,
      occupants
    });
  }

  /** Matchup principale: un attaccante → il difensore di ruolo con overlap migliore. */
  const primaryByDefender = new Map<string, ZoneOccupant>();
  const usedAttackers = new Set<string>();
  const primaryPairs = drafts.flatMap((draft) =>
    draft.occupants
      .filter((occ) =>
        rolesAreCompatible(occ.attacker.normalizedRole, draft.defender.normalizedRole) ||
        heatmapOccupiesAttackingThird(occ.attacker)
      )
      .map((occ) => ({ draft, occ }))
  );
  primaryPairs.sort((a, b) => {
    const threatDelta = b.occ.threat.threat100 - a.occ.threat.threat100;
    if (threatDelta !== 0) return threatDelta;
    const roleDelta = b.occ.roleScore - a.occ.roleScore;
    if (Math.abs(roleDelta) > 0.02) return roleDelta;
    return b.occ.overlap - a.occ.overlap;
  });
  for (const pair of primaryPairs) {
    if (usedAttackers.has(pair.occ.attacker.playerId)) continue;
    if (primaryByDefender.has(pair.draft.defender.playerId)) continue;
    primaryByDefender.set(pair.draft.defender.playerId, pair.occ);
    usedAttackers.add(pair.occ.attacker.playerId);
  }

  const scoredDrafts: Array<{
    draft: DefenderDraft;
    primary: ZoneOccupant;
    extras: ZoneOccupant[];
    zoneRaw: number;
    primaryThreat: number;
    secondaryThreat: number;
  }> = [];

  for (const draft of drafts) {
    const primary = primaryByDefender.get(draft.defender.playerId);
    if (!primary) continue;

    const extras = [...draft.occupants]
      .filter((occ) => occ.attacker.playerId !== primary.attacker.playerId)
      .filter((occ) => occ.threat.threat100 >= MARKING_THREAT_CONFIG.minZoneExtraThreat)
      .sort((a, b) => {
        const threatDelta = b.threat.threat100 - a.threat.threat100;
        if (threatDelta !== 0) return threatDelta;
        return b.overlap - a.overlap;
      })
      .slice(0, MARKING_THREAT_CONFIG.maxZoneExtras);

    const zoneMembers = [primary, ...extras];
    const zoneRaw = zoneMembers.reduce(
      (sum, occ) => sum + zonePressureContribution(occ.threat.threat100, occ.overlap),
      0
    );
    scoredDrafts.push({
      draft,
      primary,
      extras,
      zoneRaw,
      primaryThreat: primary.threat.threat100,
      secondaryThreat: extras[0]?.threat.threat100 ?? 0
    });
  }

  const maxZoneRaw = Math.max(...scoredDrafts.map((item) => item.zoneRaw), 0);
  const results: DifficultMarkingMatchup[] = [];

  for (const item of scoredDrafts) {
    const { draft, primary, extras } = item;
    const defender = draft.defender;
    const attacker = primary.attacker;
    const overlap = primary.overlap;
    const zoneNorm = difficultyScoreAgainstMatchMax(item.zoneRaw, maxZoneRaw);
    const score = defensiveDifficultyScore({
      primaryThreat: item.primaryThreat,
      zonePressureNormalized: zoneNorm,
      secondaryThreat: item.secondaryThreat
    });
    const zoneLabel = zonePressureLabelIt(zoneNorm);

    const matchupScore = computeMatchupScore({
      attacker,
      defender,
      usedHeatmap: true,
      overlap
    });
    const attackerChallenge = computeAttackerMarkingThreat(attacker, lookup, percentilePoolSize);
    const defenderVulnerability = computeDefenderVulnerabilityScore(defender, lookup);
    const lineupConfidence = lineupConfidenceScore(attacker, defender);
    const reliability = reliabilityScore({
      attacker,
      defender,
      lineupConfidence,
      usedHeatmap: true,
      percentileGroupSize: lookup.groupSize(percentileGroupForRole(attacker.normalizedRole))
    });
    const extraAttackers = extras.map((occ) => ({
      playerId: occ.attacker.playerId,
      playerName: occ.attacker.playerName,
      foulsDrawnPer90: occ.attacker.foulsDrawnPer90 ?? null,
      dribblesSuccessfulPer90: occ.attacker.dribblesSuccessfulPer90 ?? null,
      heatmapOverlapPct: Math.round(occ.overlap * 100)
    }));
    const reasons = buildReasonsForMatchup({
      attacker,
      defender,
      overlapPct: Math.round(overlap * 100),
      attackerMetrics: attackerChallenge.metrics,
      defenderMetrics: defenderVulnerability.metrics,
      usedHeatmap: true,
      extraAttackers,
      zonePressureLabel: zoneLabel,
      difficultMarkingScore: score
    });

    results.push({
      id: buildMatchupId(fixtureId, defender.playerId, attacker.playerId),
      fixtureId,
      eventId: params.match.eventId,
      competitionId: params.competitionId,
      roundKey: params.roundKey,
      homeTeamName: params.match.homeTeam.name,
      awayTeamName: params.match.awayTeam.name,
      kickoffTimestamp: params.match.startTimestamp,
      defenderPlayerId: defender.playerId,
      attackerPlayerId: attacker.playerId,
      defenderPlayerName: defender.playerName,
      attackerPlayerName: attacker.playerName,
      defenderTeamId: String(defender.teamId),
      attackerTeamId: String(attacker.teamId),
      defenderTeamName: defender.teamName,
      attackerTeamName: attacker.teamName,
      defenderRole: defender.normalizedRole,
      attackerRole: attacker.normalizedRole,
      matchupScore,
      attackerChallengeScore: primary.threat.threat01,
      defenderVulnerabilityScore:
        defenderVulnerability.score ?? absoluteDefenderVulnerabilityScore(defender) ?? 0.45,
      lineupConfidenceScore: lineupConfidence,
      reliabilityScore: reliability,
      difficultMarkingScore: score,
      difficultMarkingLevel: difficultMarkingLevelFromScore(score),
      probableZone: resolveProbableZone(overlap, attacker, defender),
      reasons,
      attackerMetrics: attackerChallenge.metrics,
      defenderMetrics: defenderVulnerability.metrics,
      sample: {
        attackerMatches: attacker.sampleMatches,
        attackerMinutes: attacker.sampleMinutes,
        defenderMatches: defender.sampleMatches,
        defenderMinutes: defender.sampleMinutes
      },
      usedHeatmap: true,
      heatmapOverlapPct: Math.round(overlap * 100),
      officialLineupsUsed: params.officialLineupsUsed ?? false,
      generatedAt,
      markingLoadCount: 1 + extras.length,
      markingKind: extras.length ? "multi" : "single",
      extraAttackers,
      leadKind: "marker",
      primaryThreatScore: item.primaryThreat,
      zonePressureScore: zoneNorm,
      secondaryThreatScore: item.secondaryThreat,
      zonePressureLabel: zoneLabel,
      visualization: {
        attackerHeatmapPoints: [...primary.attackerPoints],
        defenderHeatmapPoints: [...draft.defenderPoints],
        attackerClubColor: attacker.clubColor,
        defenderClubColor: defender.clubColor,
        attackerGrid: [...primary.attackerGrid],
        defenderGrid: [...draft.defenderGrid],
        overlapGrid: overlapGridFromLayers(primary.attackerGrid, draft.defenderGrid),
        estimatedZoneOnly: false
      }
    });
  }

  return results.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
}

function rankCoverPairs(group: DifficultMarkingMatchup[]): DifficultMarkingMatchup[] {
  return [...group]
    .sort((a, b) => {
      const aKey = foulsOverlapMarkingScore(a.heatmapOverlapPct, a.attackerMetrics.foulsDrawnPer90 ?? 0);
      const bKey = foulsOverlapMarkingScore(b.heatmapOverlapPct, b.attackerMetrics.foulsDrawnPer90 ?? 0);
      if (aKey !== bKey) return bKey - aKey;
      if (a.heatmapOverlapPct !== b.heatmapOverlapPct) return b.heatmapOverlapPct - a.heatmapOverlapPct;
      return (b.attackerMetrics.foulsDrawnPer90 ?? 0) - (a.attackerMetrics.foulsDrawnPer90 ?? 0);
    })
    .filter(
      (item) =>
        (item.attackerMetrics.foulsDrawnPer90 ?? 0) >= MIN_FOULS_SUFFERED_TO_COVER &&
        item.heatmapOverlapPct >= DUAL_LOAD_MIN_OVERLAP_PCT
    );
}

function buildMultiLoadCard(dual: DifficultMarkingMatchup[]): DifficultMarkingMatchup {
  const primary = dual[0];
  const extras = dual.slice(1).map((item) => ({
    playerId: item.attackerPlayerId,
    playerName: item.attackerPlayerName,
    foulsDrawnPer90: item.attackerMetrics.foulsDrawnPer90 ?? null,
    dribblesSuccessfulPer90: item.attackerMetrics.dribblesSuccessfulPer90 ?? null,
    heatmapOverlapPct: item.heatmapOverlapPct
  }));
  const clusterScore = clusterFoulsOverlapScore(
    dual.map((item) => ({
      heatmapOverlapPct: item.heatmapOverlapPct,
      foulsDrawnPer90: item.attackerMetrics.foulsDrawnPer90 ?? 0
    }))
  );
  const overlapDetail = dual
    .map((item) => {
      const fouls = item.attackerMetrics.foulsDrawnPer90 ?? 0;
      return `${item.attackerPlayerName} ${item.heatmapOverlapPct}% (${fouls.toFixed(1)} falli/90')`;
    })
    .join(" · ");
  const loadReason = {
    type: "MULTI_ATTACKER_LOAD" as const,
    label: `Marca ${dual.length} attaccanti con 1+ falli subiti`,
    detail: overlapDetail
  };
  const mergedAttackerPoints = dual.flatMap((item) => item.visualization?.attackerHeatmapPoints ?? []);
  return {
    ...primary,
    markingLoadCount: dual.length,
    extraAttackers: extras,
    markingKind: "multi",
    leadKind: "marker",
    difficultMarkingScore: clusterScore,
    difficultMarkingLevel: difficultMarkingLevelFromScore(clusterScore),
    visualization: primary.visualization
      ? {
          ...primary.visualization,
          attackerHeatmapPoints: mergedAttackerPoints.length
            ? mergedAttackerPoints
            : primary.visualization.attackerHeatmapPoints
        }
      : primary.visualization,
    reasons: [loadReason, ...primary.reasons.filter((r) => r.type !== "MULTI_ATTACKER_LOAD")].slice(0, 4)
  };
}

function buildSingleRoleCard(primary: DifficultMarkingMatchup): DifficultMarkingMatchup {
  const fouls = primary.attackerMetrics.foulsDrawnPer90 ?? 0;
  const dribbles = primary.attackerMetrics.dribblesSuccessfulPer90 ?? 0;
  const score = foulsDribblesMarkingScore(fouls, dribbles);
  const roleReason = {
    type: "SINGLE_ROLE_DUEL" as const,
    label: "Marcatura 1 vs 1 di ruolo",
    detail: `${roleLabelIt(primary.defenderRole)} vs ${roleLabelIt(primary.attackerRole)} · ${fouls.toFixed(1)} falli subiti e ${dribbles.toFixed(1)} dribbling riusciti /90'`
  };
  return {
    ...primary,
    markingLoadCount: 1,
    extraAttackers: [],
    markingKind: "single",
    leadKind: "marker",
    difficultMarkingScore: score,
    difficultMarkingLevel: difficultMarkingLevelFromScore(score),
    reasons: [
      roleReason,
      ...primary.reasons.filter((r) => r.type !== "SINGLE_ROLE_DUEL" && r.type !== "MULTI_ATTACKER_LOAD")
    ].slice(0, 4)
  };
}

export function partitionDefenderMarkings(matchups: DifficultMarkingMatchup[]): {
  multi: DifficultMarkingMatchup[];
  singles: DifficultMarkingMatchup[];
} {
  const multi: DifficultMarkingMatchup[] = [];
  const singles: DifficultMarkingMatchup[] = [];
  if (!matchups.length) return { multi, singles };

  const groups = new Map<string, DifficultMarkingMatchup[]>();
  for (const item of matchups) {
    const key = `${item.fixtureId}:${item.defenderPlayerId}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    const ranked = rankCoverPairs(group);
    if (ranked.length >= MIN_MARKING_LOAD) {
      multi.push(buildMultiLoadCard(ranked.slice(0, MAX_MARKING_ATTACKERS)));
      continue;
    }
    const primary = ranked[0];
    if (
      primary &&
      primary.attackerRole &&
      primary.defenderRole &&
      rolesAreCompatible(primary.attackerRole, primary.defenderRole)
    ) {
      singles.push(buildSingleRoleCard(primary));
    }
  }

  return {
    multi: multi.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore),
    singles: singles.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore)
  };
}

/**
 * Se lo stesso marcatore copre 2–3 attaccanti con 1+ falli subiti (heatmap allineate),
 * pubblica un solo card e allega gli altri con la % di sovrapposizione di ciascuno.
 */
export function collapseDefenderMultiLoad(
  matchups: DifficultMarkingMatchup[]
): DifficultMarkingMatchup[] {
  return partitionDefenderMarkings(matchups).multi;
}

export { zoneLabelIt, MATCHUP_THRESHOLD };
