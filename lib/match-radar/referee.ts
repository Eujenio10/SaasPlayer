import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import { clampScore } from "@/lib/match-radar/normalization";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";
import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";
import {
  loadCompetitionTeamMatchStatsForSimulation,
  loadRefereeMatchStats
} from "@/lib/match-simulator/persist";
import { sportApiEventPath } from "@/lib/sportapi-endpoints";
import { isInternationalSimulatorCompetition } from "@/lib/match-simulator/sample-requirements";

export interface MatchRadarRefereeProfile {
  refereeId: string;
  matchesSample: number;
  foulsPerMatch: number | null;
  yellowCardsPerMatch: number | null;
  redCardsPerMatch: number | null;
  foulsVsCompetitionPct: number | null;
  yellowCardsVsCompetitionPct: number | null;
  strictnessScore: number | null;
}

export function extractRefereeIdFromFootApiPayload(payload: unknown): string | null {
  const root = payload as Record<string, unknown>;
  const event = (root.event ?? root) as Record<string, unknown>;
  const direct = event.referee as { id?: number | string } | undefined;
  if (direct?.id != null && String(direct.id).trim()) return String(direct.id);

  const officials = event.officials;
  if (Array.isArray(officials)) {
    for (const official of officials) {
      const row = official as { id?: number | string; type?: string; name?: string };
      const type = String(row.type ?? "").toLowerCase();
      if (type.includes("referee") && row.id != null) return String(row.id);
    }
    const first = officials[0] as { id?: number | string } | undefined;
    if (first?.id != null) return String(first.id);
  }

  return null;
}

function refereeMinimumMatches(competitionId: string): number {
  if (isInternationalSimulatorCompetition(competitionId)) {
    return MATCH_RADAR_CONFIG.refereeMinimumInternationalMatches;
  }
  return MATCH_RADAR_CONFIG.refereeMinimumMatches;
}

export async function resolveRefereeProfileForMatch(params: {
  eventId: number;
  competitionId: string;
  seasonId: string;
}): Promise<MatchRadarRefereeProfile | null> {
  try {
    const response = await footApiFetch(sportApiEventPath(params.eventId));
    if (!response.ok) {
      console.info("[match-radar] referee_event_fetch_failed", {
        eventId: params.eventId,
        status: response.status
      });
      return null;
    }
    const payload = await response.json();
    const refereeId = extractRefereeIdFromFootApiPayload(payload);
    if (!refereeId) {
      console.info("[match-radar] referee_not_assigned", { eventId: params.eventId });
      return null;
    }

    const [refereeRows, competitionRows] = await Promise.all([
      loadRefereeMatchStats(refereeId),
      loadCompetitionTeamMatchStatsForSimulation({
        competitionId: params.competitionId,
        seasonId: params.seasonId,
        limit: 800
      })
    ]);

    const profile = computeRefereeStrictnessScore({
      refereeRows,
      competitionRows,
      minimumMatches: refereeMinimumMatches(params.competitionId)
    });
    if (!profile) {
      console.info("[match-radar] referee_insufficient_sample", {
        eventId: params.eventId,
        refereeId,
        rows: refereeRows.length
      });
    }
    return profile;
  } catch (error) {
    console.warn("[match-radar] referee_resolve_error", {
      eventId: params.eventId,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export function refereeProfileToSummary(
  profile: MatchRadarRefereeProfile | null
): import("@/lib/match-radar/types").MatchRadarRefereeSummary | null {
  if (!profile) return null;
  return {
    refereeId: profile.refereeId,
    strictnessScore: profile.strictnessScore,
    foulsPerMatch: profile.foulsPerMatch,
    yellowCardsPerMatch: profile.yellowCardsPerMatch,
    redCardsPerMatch: profile.redCardsPerMatch,
    foulsVsCompetitionPct: profile.foulsVsCompetitionPct,
    yellowCardsVsCompetitionPct: profile.yellowCardsVsCompetitionPct,
    matchesSample: profile.matchesSample
  };
}
function aggregateFixtureTotals(rows: NormalizedTeamMatchStats[]): Array<{
  fouls: number;
  yellowCards: number;
  redCards: number;
}> {
  const byFixture = new Map<string, NormalizedTeamMatchStats[]>();
  for (const row of rows) {
    const list = byFixture.get(row.fixtureId) ?? [];
    list.push(row);
    byFixture.set(row.fixtureId, list);
  }

  return [...byFixture.values()].map((fixtureRows) => ({
    fouls: fixtureRows.reduce((acc, row) => acc + (row.foulsCommitted ?? 0), 0),
    yellowCards: fixtureRows.reduce((acc, row) => acc + (row.yellowCards ?? 0), 0),
    redCards: fixtureRows.reduce((acc, row) => acc + (row.redCards ?? 0), 0)
  }));
}

function competitionFixtureAverages(rows: NormalizedTeamMatchStats[]): {
  foulsPerMatch: number;
  yellowCardsPerMatch: number;
} {
  const fixtures = aggregateFixtureTotals(rows);
  if (!fixtures.length) {
    return { foulsPerMatch: 24, yellowCardsPerMatch: 4 };
  }
  return {
    foulsPerMatch: fixtures.reduce((acc, f) => acc + f.fouls, 0) / fixtures.length,
    yellowCardsPerMatch: fixtures.reduce((acc, f) => acc + f.yellowCards, 0) / fixtures.length
  };
}

export function computeRefereeStrictnessScore(params: {
  refereeRows: NormalizedTeamMatchStats[];
  competitionRows: NormalizedTeamMatchStats[];
  minimumMatches?: number;
}): MatchRadarRefereeProfile | null {
  const fixtures = aggregateFixtureTotals(params.refereeRows);
  const minMatches = params.minimumMatches ?? MATCH_RADAR_CONFIG.refereeMinimumMatches;
  if (fixtures.length < minMatches) return null;

  const foulsPerMatch = fixtures.reduce((acc, f) => acc + f.fouls, 0) / fixtures.length;
  const yellowCardsPerMatch = fixtures.reduce((acc, f) => acc + f.yellowCards, 0) / fixtures.length;
  const redCardsPerMatch = fixtures.reduce((acc, f) => acc + f.redCards, 0) / fixtures.length;

  const baseline = competitionFixtureAverages(params.competitionRows);
  const foulRatio = foulsPerMatch / Math.max(baseline.foulsPerMatch, 12);
  const cardRatio = yellowCardsPerMatch / Math.max(baseline.yellowCardsPerMatch, 2.5);

  const strictnessScore = clampScore(
    foulRatio * MATCH_RADAR_CONFIG.refereeFoulsWeight * 100 +
      cardRatio * MATCH_RADAR_CONFIG.refereeCardsWeight * 100
  );

  return {
    refereeId: params.refereeRows[0]?.refereeId ?? "unknown",
    matchesSample: fixtures.length,
    foulsPerMatch: Number(foulsPerMatch.toFixed(1)),
    yellowCardsPerMatch: Number(yellowCardsPerMatch.toFixed(1)),
    redCardsPerMatch: Number(redCardsPerMatch.toFixed(2)),
    foulsVsCompetitionPct: Math.round(foulRatio * 100),
    yellowCardsVsCompetitionPct: Math.round(cardRatio * 100),
    strictnessScore
  };
}

export function blendIntensityWithReferee(
  intensity: number | null,
  refereeStrictness: number | null
): number | null {
  if (intensity == null && refereeStrictness == null) return null;
  if (intensity == null) return refereeStrictness;
  if (refereeStrictness == null) return intensity;
  const w = MATCH_RADAR_CONFIG.refereeIntensityBlend;
  return clampScore(intensity * (1 - w) + refereeStrictness * w);
}

export function refereeRadarBoost(refereeStrictness: number | null): number {
  if (refereeStrictness == null) return 0;
  if (refereeStrictness < MATCH_RADAR_CONFIG.refereeBoostThreshold) return 0;
  const span = 100 - MATCH_RADAR_CONFIG.refereeBoostThreshold;
  const progress = (refereeStrictness - MATCH_RADAR_CONFIG.refereeBoostThreshold) / span;
  return clampScore(progress * MATCH_RADAR_CONFIG.refereeMaxRadarBoost);
}
