export function normalizeStatKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function coerceStatValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export interface ParsedTeamSideStats {
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  possession: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
  saves: number | null;
  offsides: number | null;
  shotsOutsideBox: number | null;
  expectedGoals: number | null;
}

export function parseAllPeriodStats(
  payload: {
    statistics?: Array<{
      period?: string;
      groups?: Array<{
        statisticsItems?: Array<{
          key?: string;
          homeValue?: number;
          awayValue?: number;
        }>;
      }>;
    }>;
  }
): Map<string, { home: number; away: number }> {
  const map = new Map<string, { home: number; away: number }>();
  const all = (payload.statistics ?? []).find((item) => item.period?.toUpperCase() === "ALL");
  if (!all) return map;
  for (const group of all.groups ?? []) {
    for (const item of group.statisticsItems ?? []) {
      const key = item.key?.trim();
      if (!key) continue;
      map.set(normalizeStatKey(key), {
        home: coerceStatValue(item.homeValue),
        away: coerceStatValue(item.awayValue)
      });
    }
  }
  return map;
}

/** Chiavi corte tipo `red` non devono matchare `totalDistanceCovered` (contiene "red"). */
function keysLooselyMatch(foundKey: string, wanted: string): boolean {
  if (foundKey === wanted) return true;
  if (wanted.length < 4) return false;
  return foundKey.startsWith(wanted) || wanted.startsWith(foundKey);
}

function resolveSideValueExact(
  statMap: Map<string, { home: number; away: number }>,
  keys: string[],
  side: "home" | "away"
): number | null {
  for (const key of keys) {
    const entry = statMap.get(normalizeStatKey(key));
    if (entry) return side === "home" ? entry.home : entry.away;
  }
  return null;
}

function resolveSideValue(
  statMap: Map<string, { home: number; away: number }>,
  keys: string[],
  side: "home" | "away"
): number | null {
  for (const key of keys) {
    const normalized = normalizeStatKey(key);
    const entry = statMap.get(normalized);
    if (entry) return side === "home" ? entry.home : entry.away;
  }
  for (const key of keys) {
    const wanted = normalizeStatKey(key);
    for (const [foundKey, entry] of statMap.entries()) {
      if (keysLooselyMatch(foundKey, wanted)) {
        return side === "home" ? entry.home : entry.away;
      }
    }
  }
  return null;
}

export function extractTeamSideStats(
  statMap: Map<string, { home: number; away: number }>,
  side: "home" | "away"
): ParsedTeamSideStats {
  const shotsOnTarget = resolveSideValue(statMap, [
    "shotsOnTarget",
    "shotsOnGoal",
    "onTargetScoringAttempt",
    "shotson"
  ], side);
  const shotsOff = resolveSideValue(statMap, ["shotOffTarget", "shotsOffTarget", "offTargetScoringAttempt"], side);
  const shotsBlocked = resolveSideValue(statMap, ["blockedShots", "blockedScoringAttempt"], side);
  let shots = resolveSideValue(statMap, ["totalShots", "shots", "attempts"], side);
  if (shots == null && (shotsOnTarget != null || shotsOff != null || shotsBlocked != null)) {
    shots = (shotsOnTarget ?? 0) + (shotsOff ?? 0) + (shotsBlocked ?? 0);
  }

  return {
    shots,
    shotsOnTarget,
    corners: resolveSideValue(statMap, ["cornerKicks", "corners"], side),
    possession: resolveSideValue(statMap, ["ballPossession", "possession"], side),
    fouls: resolveSideValue(statMap, ["fouls", "foulsCommitted"], side),
    yellowCards: resolveSideValueExact(statMap, ["yellowCards", "yellowCard"], side),
    redCards: (() => {
      const red = resolveSideValueExact(statMap, ["redCards", "redCard", "directRedCards"], side);
      const yellowRed = resolveSideValueExact(statMap, ["yellowRedCards", "yellowRedCard"], side);
      if (red == null && yellowRed == null) return null;
      return (red ?? 0) + (yellowRed ?? 0);
    })(),
    saves: resolveSideValue(statMap, ["goalkeeperSaves", "saves", "keeperSaves"], side),
    offsides: resolveSideValue(statMap, ["offsides", "offside"], side),
    shotsOutsideBox: resolveSideValue(
      statMap,
      ["shotsOutsideBox", "shotsFromOutsideTheBox", "totalShotsOutsideBox"],
      side
    ),
    expectedGoals: resolveSideValue(statMap, ["expectedGoals", "xg", "expectedGoalsCreated"], side)
  };
}

export function computeDataCompleteness(stats: ParsedTeamSideStats): number {
  const fields = [
    stats.shots,
    stats.shotsOnTarget,
    stats.corners,
    stats.possession,
    stats.fouls,
    stats.yellowCards,
    stats.redCards
  ];
  const available = fields.filter((v) => v != null).length;
  return available / fields.length;
}
