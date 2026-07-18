import { resolveMatchCompetitionId } from "@/lib/competitions";
import { buildProfilesFromMetrics } from "@/lib/difficult-markings/profiles";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";
import { selectCanonicalMatchupsForMatch } from "@/lib/difficult-markings/publish";
import { computeDifficultMarkingsForMatch } from "@/lib/difficult-markings/scoring";
import type {
  DifficultMarkingsRoundBucket,
  DifficultMarkingsSnapshot,
  DifficultMarkingMatchup
} from "@/lib/difficult-markings/types";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

function isInternationalMarkingsCompetition(competitionId?: string): boolean {
  const id = canonicalCompetitionId(competitionId);
  return id === "world-cup" || id === "uefa-nations-league";
}

export function roundKeyFromMatch(match: UpcomingMatchItem): string {
  const d = new Date(match.startTimestamp * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function competitionIdFromMatch(match: UpcomingMatchItem): string {
  return (
    resolveMatchCompetitionId(match) ||
    canonicalCompetitionId(match.competitionSlug) ||
    match.competitionSlug?.trim() ||
    "unknown"
  );
}

export interface MatchInsightsBundle {
  match: UpcomingMatchItem;
  metrics: TacticalMetrics[];
}

export function computeDifficultMarkingsSnapshot(params: {
  bundles: MatchInsightsBundle[];
  insightsSnap: number;
  officialLineupsUsed?: boolean;
}): DifficultMarkingsSnapshot {
  const started = Date.now();
  const generatedAt = new Date().toISOString();
  const allProfiles = params.bundles.flatMap((bundle) =>
    buildProfilesFromMetrics({
      metrics: bundle.metrics,
      homeTeamId: bundle.match.homeTeam.id,
      awayTeamId: bundle.match.awayTeam.id
    })
  );

  const roundBuckets = new Map<string, DifficultMarkingsRoundBucket>();
  const matchupIndex: Record<string, DifficultMarkingMatchup> = {};
  let pairsGenerated = 0;
  let pairsPublished = 0;
  let rawMatchups = 0;

  for (const bundle of params.bundles) {
    if (!bundle.metrics.length) continue;

    const competitionId = competitionIdFromMatch(bundle.match);
    const roundKey = roundKeyFromMatch(bundle.match);
    const bucketKey = `${competitionId}|${roundKey}`;

    const profiles = buildProfilesFromMetrics({
      metrics: bundle.metrics,
      homeTeamId: bundle.match.homeTeam.id,
      awayTeamId: bundle.match.awayTeam.id
    });

    const poolProfiles = allProfiles.filter((p) => {
      const sameCompetitionBundles = params.bundles.filter(
        (b) => competitionIdFromMatch(b.match) === competitionId && roundKeyFromMatch(b.match) === roundKey
      );
      const ids = new Set(sameCompetitionBundles.flatMap((b) => [b.match.homeTeam.id, b.match.awayTeam.id]));
      return ids.has(p.teamId);
    });

    pairsGenerated += profiles.filter((p) => p.normalizedRole !== "GK").length;

    const raw = computeDifficultMarkingsForMatch({
      match: bundle.match,
      profiles,
      percentilePool: poolProfiles.length >= 8 ? poolProfiles : allProfiles,
      competitionId,
      roundKey,
      officialLineupsUsed: params.officialLineupsUsed ?? false,
      generatedAt
    });

    rawMatchups += raw.length;
    const selected = selectCanonicalMatchupsForMatch(raw, {
      maxPerMatch: 3,
      minAttackerThreat: isInternationalMarkingsCompetition(competitionId) ? 0.15 : 0.35
    });
    pairsPublished += selected.length;

    if (!roundBuckets.has(bucketKey)) {
      roundBuckets.set(bucketKey, {
        competitionId,
        round: roundKey,
        generatedAt,
        officialLineupsUsed: params.officialLineupsUsed ?? false,
        results: []
      });
    }

    const bucket = roundBuckets.get(bucketKey)!;
    for (const item of selected) {
      bucket.results.push(item);
      matchupIndex[item.id] = item;
    }
  }

  for (const bucket of roundBuckets.values()) {
    const intl = isInternationalMarkingsCompetition(bucket.competitionId);
    bucket.results = selectCanonicalMatchupsForMatch(bucket.results, {
      maxPerMatch: 2,
      minAttackerThreat: intl ? 0.15 : 0.35
    }).sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
  }

  const rounds = [...roundBuckets.values()]
    .filter((bucket) => bucket.results.length > 0)
    .sort((a, b) => b.round.localeCompare(a.round));
  const competitionIds = [...new Set(Object.values(matchupIndex).map((m) => m.competitionId))];
  const elapsedMs = Date.now() - started;
  console.info("[difficult-markings] snapshot_built", {
    matchesAnalyzed: params.bundles.length,
    pairsGenerated,
    rawMatchups,
    pairsPublished,
    rounds: rounds.length,
    competitionIds,
    elapsedMs
  });

  return {
    insightsSnap: params.insightsSnap,
    rounds,
    matchupIndex,
    updatedAt: generatedAt
  };
}

export function findRoundBucket(
  snapshot: DifficultMarkingsSnapshot | null | undefined,
  competitionId: string,
  round: string
): DifficultMarkingsRoundBucket | null {
  if (!snapshot?.rounds?.length) return null;
  const normalized = canonicalCompetitionId(competitionId) || competitionId;
  return (
    snapshot.rounds.find((r) => r.competitionId === normalized && String(r.round) === String(round)) ??
    snapshot.rounds.find((r) => r.competitionId === normalized) ??
    null
  );
}

export function findMatchupInSnapshot(
  snapshot: DifficultMarkingsSnapshot | null | undefined,
  matchupId: string
): DifficultMarkingMatchup | null {
  if (!snapshot) return null;
  return snapshot.matchupIndex?.[matchupId] ?? null;
}
