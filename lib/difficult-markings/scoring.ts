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
  profileActsAsAttacker,
  profileActsAsDefender,
  roleCompatibilityScore,
  rolesAreCompatible
} from "@/lib/difficult-markings/roles";
import type {
  DifficultMarkingLevel,
  DifficultMarkingMatchup,
  PlayerRecentProfile,
  ProbableZone
} from "@/lib/difficult-markings/types";
import type { UpcomingMatchItem } from "@/services/sportapi";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";

const MATCHUP_THRESHOLD = 0.58;
const MIN_ATTACKER_THREAT = 0.45;
const MIN_ATTACKER_FOULS_DRAWN = 1.35;
const MIN_ATTACKER_DRIBBLES_OK = 0.95;
const MIN_ATTACKER_DRIBBLES_ATT = 2.2;

function isInternationalMarkingsCompetition(competitionId?: string): boolean {
  const id = canonicalCompetitionId(competitionId);
  return id === "world-cup" || id === "uefa-nations-league";
}

function publicationThresholds(competitionId?: string) {
  const international = isInternationalMarkingsCompetition(competitionId);
  return {
    matchupThreshold: international ? 0.42 : MATCHUP_THRESHOLD,
    minAttackerThreat: international ? 0.28 : MIN_ATTACKER_THREAT,
    minAttackerFoulsDrawn: international ? 0.6 : MIN_ATTACKER_FOULS_DRAWN,
    minAttackerDribblesOk: international ? 0.45 : MIN_ATTACKER_DRIBBLES_OK,
    minAttackerDribblesAtt: international ? 1.1 : MIN_ATTACKER_DRIBBLES_ATT,
    minDifficultMarkingScore: international ? 36 : 52,
    minReliability: international ? 0.22 : 0.45,
    minSampleMatches: international ? 1 : 3,
    minSampleMinutes: international ? 90 : 270
  };
}

/** Soglie di emergenza: se i filtri stretti azzerano tutto, pubblica comunque i top pairing. */
function softPublicationThresholds(competitionId?: string) {
  const international = isInternationalMarkingsCompetition(competitionId);
  return {
    matchupThreshold: international ? 0.28 : 0.4,
    minAttackerThreat: international ? 0.15 : 0.28,
    minAttackerFoulsDrawn: international ? 0.25 : 0.7,
    minAttackerDribblesOk: international ? 0.2 : 0.5,
    minAttackerDribblesAtt: international ? 0.6 : 1.2,
    minDifficultMarkingScore: international ? 28 : 40,
    minReliability: international ? 0.12 : 0.28,
    minSampleMatches: international ? 1 : 2,
    minSampleMinutes: international ? 45 : 180
  };
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
    return clamp(
      0.5 * params.overlap + 0.3 * roleScore + 0.2 * formationScore,
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

function defenderDisciplineModifier(defender: PlayerRecentProfile): number {
  const vuln = absoluteDefenderVulnerabilityScore(defender) ?? 0.45;
  return clamp(0.92 + vuln * 0.14, 0.92, 1.06);
}

/** Tetto massimo plausibile in base alle medie reali dell'attaccante (evita 100% senza numeri). */
function attackerStatScoreCap(attacker: PlayerRecentProfile): number {
  const foulsDrawn = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  const raw =
    0.48 * clamp(foulsDrawn / 3.0, 0, 1) +
    0.34 * clamp(dribblesOk / 2.4, 0, 1) +
    0.18 * clamp(dribblesAtt / 5.5, 0, 1);
  return Math.round(44 + raw * 52);
}

function attackerHasMeaningfulOffensiveProfile(
  attacker: PlayerRecentProfile,
  competitionId?: string,
  soft = false
): boolean {
  const thresholds = soft
    ? softPublicationThresholds(competitionId)
    : publicationThresholds(competitionId);
  const foulsDrawn = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  return (
    foulsDrawn >= thresholds.minAttackerFoulsDrawn ||
    dribblesOk >= thresholds.minAttackerDribblesOk ||
    dribblesAtt >= thresholds.minAttackerDribblesAtt
  );
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
    { weight: 0.4, value: foulsDrawn },
    { weight: 0.3, value: dribblesAttempted },
    { weight: 0.2, value: dribblesSuccessful },
    { weight: 0.1, value: duelsWon }
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
  const { score } = redistributeWeightedScore([
    {
      weight: 0.4,
      value:
        attacker.foulsDrawnPer90 != null
          ? clamp(attacker.foulsDrawnPer90 / 3.2, 0, 1)
          : null
    },
    {
      weight: 0.3,
      value:
        attacker.dribblesAttemptedPer90 != null
          ? clamp(attacker.dribblesAttemptedPer90 / 6.5, 0, 1)
          : null
    },
    {
      weight: 0.2,
      value:
        attacker.dribblesSuccessfulPer90 != null
          ? clamp(attacker.dribblesSuccessfulPer90 / 3.5, 0, 1)
          : null
    },
    { weight: 0.1, value: null }
  ]);
  return score;
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

function meetsSampleRequirement(
  player: PlayerRecentProfile,
  competitionId?: string,
  soft = false
): boolean {
  const thresholds = soft
    ? softPublicationThresholds(competitionId)
    : publicationThresholds(competitionId);
  if (player.sampleMatches >= 5 && player.sampleMinutes >= 450) return true;

  const hasRealMetrics =
    (player.foulsDrawnPer90 ?? 0) >= (soft ? 0.3 : 0.8) ||
    (player.foulsCommittedPer90 ?? 0) >= (soft ? 0.3 : 0.8) ||
    (player.dribblesAttemptedPer90 ?? 0) >= (soft ? 0.5 : 1.5) ||
    (soft && player.sampleMatches >= 1 && player.sampleMinutes >= 45);

  return (
    hasRealMetrics &&
    player.sampleMatches >= thresholds.minSampleMatches &&
    player.sampleMinutes >= thresholds.minSampleMinutes
  );
}

function passesPublicationThresholds(params: {
  matchupScore: number;
  attackerChallengeScore: number;
  difficultMarkingScore: number;
  reliabilityScore: number;
  attacker: PlayerRecentProfile;
  defender: PlayerRecentProfile;
  competitionId?: string;
  soft?: boolean;
}): boolean {
  const thresholds = params.soft
    ? softPublicationThresholds(params.competitionId)
    : publicationThresholds(params.competitionId);
  return (
    meetsSampleRequirement(params.attacker, params.competitionId, params.soft) &&
    meetsSampleRequirement(params.defender, params.competitionId, params.soft) &&
    attackerHasMeaningfulOffensiveProfile(params.attacker, params.competitionId, params.soft) &&
    params.matchupScore >= thresholds.matchupThreshold &&
    params.attackerChallengeScore >= thresholds.minAttackerThreat &&
    params.difficultMarkingScore >= thresholds.minDifficultMarkingScore &&
    params.reliabilityScore >= thresholds.minReliability
  );
}

export function buildMatchupId(fixtureId: string, defenderId: string, attackerId: string): string {
  return `${fixtureId}-${defenderId}-${attackerId}`;
}

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
  const hardThresholds = publicationThresholds(params.competitionId);
  const softThresholds = softPublicationThresholds(params.competitionId);

  const defenders = params.profiles.filter((p) => profileActsAsDefender(p));
  const attackers = params.profiles.filter((p) => profileActsAsAttacker(p));

  const scoreCandidates = (soft: boolean): DifficultMarkingMatchup[] => {
    const thresholds = soft ? softThresholds : hardThresholds;
    const results: DifficultMarkingMatchup[] = [];

    for (const defender of defenders) {
      for (const attacker of attackers) {
        if (defender.teamId === attacker.teamId) continue;
        if (!rolesAreCompatible(attacker.normalizedRole, defender.normalizedRole)) continue;

        const defenderPoints = defender.heatmapPointsMatchFrame;
        const attackerPoints = attacker.heatmapPointsMatchFrame;
        const usedHeatmap =
          (defenderPoints?.length ?? 0) >= 3 && (attackerPoints?.length ?? 0) >= 3;

        let attackerGrid: number[];
        let defenderGrid: number[];
        if (usedHeatmap && attacker.offensiveHeatmap && defender.defensiveHeatmap) {
          attackerGrid = attacker.offensiveHeatmap;
          defenderGrid = defender.defensiveHeatmap;
        } else if (usedHeatmap && attacker.offensiveHeatmap && defender.offensiveHeatmap) {
          attackerGrid = attacker.offensiveHeatmap;
          defenderGrid = defender.offensiveHeatmap;
        } else {
          /** Solo heatmap reali: niente zone stimate da ruolo. */
          continue;
        }

        const usedHeatmapForScore = true;
        const overlap = heatmapOverlap(attackerGrid, defenderGrid);
        if (overlap < 0.35) {
          /** Senza overlap reale sufficiente non pubblichiamo il duello (niente zone stimate). */
          continue;
        }

        const matchupScore = computeMatchupScore({
          attacker,
          defender,
          usedHeatmap: usedHeatmapForScore,
          overlap
        });
        if (matchupScore < thresholds.matchupThreshold) continue;

        const attackerChallenge = computeAttackerMarkingThreat(attacker, lookup, percentilePoolSize);
        const defenderVulnerability = computeDefenderVulnerabilityScore(defender, lookup);
        const attackerChallengeScore = attackerChallenge.score;
        const defenderVulnerabilityScore =
          defenderVulnerability.score ?? absoluteDefenderVulnerabilityScore(defender);

        if (attackerChallengeScore == null || defenderVulnerabilityScore == null) continue;
        if (!attackerHasMeaningfulOffensiveProfile(attacker, params.competitionId, soft)) continue;

        const lineupConfidence = lineupConfidenceScore(attacker, defender);
        const fitBlend = 0.68 + 0.32 * matchupScore;
        const rawDifficultMarkingScore =
          attackerChallengeScore * fitBlend * defenderDisciplineModifier(defender) * lineupConfidence;
        let difficultMarkingScore = Math.round(
          calibrateDifficultMarkingScore(rawDifficultMarkingScore, params.competitionId) * 100
        );
        difficultMarkingScore = Math.min(
          difficultMarkingScore,
          attackerStatScoreCap(attacker) + Math.round(matchupScore * 6)
        );
        const reliability = reliabilityScore({
          attacker,
          defender,
          lineupConfidence,
          usedHeatmap: usedHeatmapForScore,
          percentileGroupSize: lookup.groupSize(percentileGroupForRole(attacker.normalizedRole))
        });

        if (
          !passesPublicationThresholds({
            matchupScore,
            attackerChallengeScore,
            difficultMarkingScore,
            reliabilityScore: reliability,
            attacker,
            defender,
            competitionId: params.competitionId,
            soft
          })
        ) {
          continue;
        }

        const level = difficultMarkingLevelFromScore(difficultMarkingScore);
        const probableZone = resolveProbableZone(overlap, attacker, defender);
        const reasons = buildReasonsForMatchup({
          attacker,
          defender,
          overlapPct: Math.round(overlap * 100),
          attackerMetrics: attackerChallenge.metrics,
          defenderMetrics: defenderVulnerability.metrics,
          usedHeatmap
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
          attackerChallengeScore,
          defenderVulnerabilityScore,
          lineupConfidenceScore: lineupConfidence,
          reliabilityScore: reliability,
          difficultMarkingScore,
          difficultMarkingLevel: level,
          probableZone,
          reasons,
          attackerMetrics: attackerChallenge.metrics,
          defenderMetrics: defenderVulnerability.metrics,
          sample: {
            attackerMatches: attacker.sampleMatches,
            attackerMinutes: attacker.sampleMinutes,
            defenderMatches: defender.sampleMatches,
            defenderMinutes: defender.sampleMinutes
          },
          usedHeatmap: usedHeatmapForScore,
          heatmapOverlapPct: Math.round(overlap * 100),
          officialLineupsUsed: params.officialLineupsUsed ?? false,
          generatedAt,
          visualization: {
            attackerHeatmapPoints: attackerPoints ? [...attackerPoints] : [],
            defenderHeatmapPoints: defenderPoints ? [...defenderPoints] : [],
            attackerClubColor: attacker.clubColor,
            defenderClubColor: defender.clubColor,
            attackerGrid: [...attackerGrid],
            defenderGrid: [...defenderGrid],
            overlapGrid: overlapGridFromLayers(attackerGrid, defenderGrid),
            estimatedZoneOnly: !usedHeatmapForScore
          }
        });
      }
    }

    return results.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
  };

  const hard = scoreCandidates(false);
  if (hard.length > 0) return hard;

  const soft = scoreCandidates(true).slice(0, 8);
  if (soft.length > 0) {
    console.info("[difficult-markings] soft_publish_fallback", {
      fixtureId,
      competitionId: params.competitionId,
      softMatchups: soft.length
    });
  }
  return soft;
}

export { zoneLabelIt, MATCHUP_THRESHOLD };
