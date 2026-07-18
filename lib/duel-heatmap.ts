import type { SparkFrictionHeatmapPayload, TacticalMetrics } from "@/lib/types";

export interface DuelHeatmapPayload {
  labelA: string;
  labelB: string;
  clubColorA: string;
  clubColorB: string;
  pointsA: Array<{ x: number; y: number; intensity?: number }>;
  pointsB: Array<{ x: number; y: number; intensity?: number }>;
}

const MIN_MATCH_FRAME_POINTS = 1;

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeTeam(team: string): string {
  return team
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\bnational team\b/g, "")
    .replace(/\bfc\b/g, "")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function duelMatchesSparkPair(player: TacticalMetrics, opp: TacticalMetrics): boolean {
  const spark = player.sparkDuel;
  if (spark) {
    const idHit =
      typeof opp.playerId === "number" &&
      opp.playerId > 0 &&
      typeof spark.playerBId === "number" &&
      spark.playerBId === opp.playerId;
    const nameHit = normalizeName(spark.playerB) === normalizeName(opp.playerName);
    if (idHit || nameHit) return true;
  }

  const friction = player.sparkFrictionHeatmap;
  if (friction) {
    const nameHit = normalizeName(friction.labelB) === normalizeName(opp.playerName);
    if (nameHit) return true;
  }

  return false;
}

function payloadFromSparkHeatmap(
  hm: SparkFrictionHeatmapPayload
): DuelHeatmapPayload | null {
  if ((hm.pointsA?.length ?? 0) < MIN_MATCH_FRAME_POINTS || (hm.pointsB?.length ?? 0) < MIN_MATCH_FRAME_POINTS) {
    return null;
  }
  return {
    labelA: hm.labelA,
    labelB: hm.labelB,
    clubColorA: hm.clubColorA,
    clubColorB: hm.clubColorB,
    pointsA: hm.pointsA,
    pointsB: hm.pointsB
  };
}

function payloadFromMatchFrames(a: TacticalMetrics, b: TacticalMetrics): DuelHeatmapPayload | null {
  const pa = a.heatmapPointsMatchFrame;
  const pb = b.heatmapPointsMatchFrame;
  if (!pa?.length || !pb?.length) return null;
  if (pa.length < MIN_MATCH_FRAME_POINTS || pb.length < MIN_MATCH_FRAME_POINTS) return null;
  return {
    labelA: a.playerName,
    labelB: b.playerName,
    clubColorA: a.clubColor || "#8b5cf6",
    clubColorB: b.clubColor || "#c084fc",
    pointsA: pa,
    pointsB: pb
  };
}

function trySparkHeatmap(a: TacticalMetrics, b: TacticalMetrics): DuelHeatmapPayload | null {
  for (const [player, opp] of [
    [a, b],
    [b, a]
  ] as const) {
    if (player.sparkFrictionHeatmap && duelMatchesSparkPair(player, opp)) {
      const payload = payloadFromSparkHeatmap(player.sparkFrictionHeatmap);
      if (payload) return payload;
    }
  }
  return null;
}

export function resolveDuelHeatmapPayload(
  player: TacticalMetrics | undefined,
  opponent: TacticalMetrics | undefined
): DuelHeatmapPayload | null {
  if (!player || !opponent) return null;

  const sparkPayload = trySparkHeatmap(player, opponent);
  if (sparkPayload) return sparkPayload;

  return payloadFromMatchFrames(player, opponent);
}

export function findTacticalMetric(
  metrics: TacticalMetrics[],
  name: string,
  team: string,
  playerId?: number
): TacticalMetrics | undefined {
  if (typeof playerId === "number" && playerId > 0) {
    const byId = metrics.find((m) => m.playerId === playerId);
    if (byId) return byId;
  }

  const normName = normalizeName(name);
  const byName = metrics.filter((m) => normalizeName(m.playerName) === normName);
  if (!byName.length) return undefined;
  if (byName.length === 1) return byName[0];

  const withTeam = byName.find((m) => teamsMatch(m.team, team));
  return withTeam ?? byName[0];
}
