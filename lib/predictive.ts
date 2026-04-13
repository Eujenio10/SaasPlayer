import type { SportPerformanceInput, TacticalMetrics } from "@/lib/types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ribalta solo X (fallback legacy quando non si conosce la squadra di casa).
 */
function mirrorHeatmapPointsX(
  points: SportPerformanceInput["heatmapPoints"]
): SportPerformanceInput["heatmapPoints"] {
  return points.map((p) => ({
    ...p,
    x: clamp(100 - p.x, 0, 100)
  }));
}

/**
 * Inverte entrambe le coordinate sul campo [0,100]×[0,100] (simmetria centrale):
 * così la Squadra B (away), con dati grezzi in direzione d’attacco opposta alla A, viene portata
 * nello stesso sistema della casa: TD vs AS avversaria possono sovrapporsi nella stessa fascia tattica.
 */
function flipHeatmapCoordinatesForAwayTeam(
  points: SportPerformanceInput["heatmapPoints"]
): SportPerformanceInput["heatmapPoints"] {
  return points.map((p) => ({
    ...p,
    x: clamp(100 - p.x, 0, 100),
    y: clamp(100 - p.y, 0, 100)
  }));
}

/**
 * Sistema di riferimento unico “come la Squadra A (casa)”: i punti della trasferta subiscono
 * `flipHeatmapCoordinatesForAwayTeam` prima di overlap, centroidi e rendering.
 */
function normalizeHeatmapToHomeFrame(
  points: SportPerformanceInput["heatmapPoints"],
  teamId: number,
  homeTeamId: number
): SportPerformanceInput["heatmapPoints"] {
  if (!points.length) return points;
  if (teamId === homeTeamId) return points;
  return flipHeatmapCoordinatesForAwayTeam(points);
}

function heatmapCentroid(
  points: SportPerformanceInput["heatmapPoints"]
): { x: number; y: number } {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce<{ x: number; y: number; total: number }>(
    (acc, point) => {
      const weight = point.intensity ?? 1;
      return {
        x: acc.x + point.x * weight,
        y: acc.y + point.y * weight,
        total: acc.total + weight
      };
    },
    { x: 0, y: 0, total: 0 }
  );

  if (sum.total === 0) {
    return { x: 0, y: 0 };
  }

  return { x: sum.x / sum.total, y: sum.y / sum.total };
}

function centroidDistance(
  a: SportPerformanceInput["heatmapPoints"],
  b: SportPerformanceInput["heatmapPoints"]
): number {
  const c1 = heatmapCentroid(a);
  const c2 = heatmapCentroid(b);
  return Math.hypot(c1.x - c2.x, c1.y - c2.y);
}

/** Pochi punti = centroid instabile: si usa solo il blend fisico. */
const MIN_HEATMAP_POINTS_FOR_SPATIAL = 3;

function foulFrictionScore(athlete: SportPerformanceInput, opponent: SportPerformanceInput): number {
  return clamp(
    (athlete.foulsCommitted + opponent.foulsSuffered) * 12 +
      (athlete.foulsSuffered + opponent.foulsCommitted) * 6,
    0,
    100
  );
}

type RoleKind = "gk" | "def" | "mid" | "fwd";

function roleKindFromRole(role: string): RoleKind {
  const r = role.toLowerCase();
  if (r.includes("goal")) return "gk";
  if (r.includes("def")) return "def";
  if (r.includes("for") || r.includes("att")) return "fwd";
  return "mid";
}

/**
 * Fascia orizzontale da codice posizione in formazione (DL, MR, AML, LW…).
 * -1 sinistra, +1 destra, 0 centro / non determinabile.
 */
function lineupPositionFlank(positionCode: string | undefined): number {
  if (!positionCode) return 0;
  const s = positionCode.toUpperCase().trim().replace(/\s+/g, "");
  if (!s || s === "G" || s.startsWith("GK")) return 0;

  const wingLeft = /^(DL|LWB|LB|ML|AML|LW|LM|WL)(\/|$)/.test(s) || /\bLW\b/.test(s);
  const wingRight = /^(DR|RWB|RB|MR|AMR|RW|RM|WR)(\/|$)/.test(s) || /\bRW\b/.test(s);
  if (wingLeft && !wingRight) return -1;
  if (wingRight && !wingLeft) return 1;

  const last = s[s.length - 1];
  const first = s[0];
  if (last === "L" && /^[DAMFW]/.test(first)) return -1;
  if (last === "R" && /^[DAMFW]/.test(first)) return 1;

  return 0;
}

function heatmapPointsInHomeFrame(
  athlete: SportPerformanceInput,
  homeTeamId?: number
): SportPerformanceInput["heatmapPoints"] {
  if (!athlete.heatmapPoints.length) return [];
  if (homeTeamId !== undefined && homeTeamId > 0) {
    return normalizeHeatmapToHomeFrame(athlete.heatmapPoints, athlete.teamId, homeTeamId);
  }
  return athlete.heatmapPoints;
}

/** Inclinazione laterale -1…+1 da heatmap (e integrazione con positionCode). */
function effectiveLateralLean(
  athlete: SportPerformanceInput,
  pointsHomeOrRaw: SportPerformanceInput["heatmapPoints"],
  homeTeamId?: number
): number {
  const posFlank = lineupPositionFlank(athlete.positionCode);
  const posN = posFlank === 0 ? 0 : posFlank * 0.55;

  if (pointsHomeOrRaw.length >= MIN_HEATMAP_POINTS_FOR_SPATIAL) {
    const cx = heatmapCentroid(pointsHomeOrRaw).x;
    const h = clamp((cx - 50) / 50, -1, 1);
    return clamp(h * 0.74 + posN * 0.26, -1, 1);
  }

  return posN !== 0 ? clamp(posN, -1, 1) : 0;
}

/**
 * Stessa logica della distanza spatial: scegli specchiatura avversario se serve (senza frame casa).
 */
function lateralLeanPairForMarking(
  athlete: SportPerformanceInput,
  opponent: SportPerformanceInput,
  homeTeamId?: number
): { la: number; lb: number; ya: number; yb: number } {
  const useHome = homeTeamId !== undefined && homeTeamId > 0;
  const ptsA = heatmapPointsInHomeFrame(athlete, homeTeamId);
  const ptsB = heatmapPointsInHomeFrame(opponent, homeTeamId);

  if (useHome || ptsA.length < MIN_HEATMAP_POINTS_FOR_SPATIAL || ptsB.length < MIN_HEATMAP_POINTS_FOR_SPATIAL) {
    const la = effectiveLateralLean(athlete, ptsA, homeTeamId);
    const lb = effectiveLateralLean(opponent, ptsB, homeTeamId);
    const ca = heatmapCentroid(ptsA);
    const cb = heatmapCentroid(ptsB);
    return { la, lb, ya: ca.y, yb: cb.y };
  }

  const cA = heatmapCentroid(ptsA);
  const cB = heatmapCentroid(ptsB);
  const cBm = heatmapCentroid(mirrorHeatmapPointsX(ptsB));
  const useMirroredB = Math.hypot(cA.x - cB.x, cA.y - cB.y) > Math.hypot(cA.x - cBm.x, cA.y - cBm.y);
  const cBOpp = useMirroredB ? cBm : cB;
  const la = clamp((cA.x - 50) / 50, -1, 1);
  const lbRaw = clamp((cBOpp.x - 50) / 50, -1, 1);
  const lb =
    lineupPositionFlank(opponent.positionCode) !== 0
      ? clamp(lbRaw * 0.62 + lineupPositionFlank(opponent.positionCode) * 0.55 * 0.38, -1, 1)
      : lbRaw;
  const laAdj =
    lineupPositionFlank(athlete.positionCode) !== 0
      ? clamp(la * 0.62 + lineupPositionFlank(athlete.positionCode) * 0.55 * 0.38, -1, 1)
      : la;
  return { la: laAdj, lb, ya: cA.y, yb: cBOpp.y };
}

/** 0–40: quanto il duello ricorda una marcatura “naturale” (fascia + ruoli). */
function markingAffinityScore(
  athlete: SportPerformanceInput,
  opponent: SportPerformanceInput,
  homeTeamId?: number
): number {
  const rkA = roleKindFromRole(athlete.role);
  const rkB = roleKindFromRole(opponent.role);
  if (rkA === "gk" || rkB === "gk") return 0;

  const { la, lb, ya, yb } = lateralLeanPairForMarking(athlete, opponent, homeTeamId);
  const laneMatch = clamp(1 - Math.min(1, Math.abs(la - lb) / 0.88), 0, 1);

  let score = laneMatch * 15;

  const wideA = Math.abs(la) > 0.24;
  const wideB = Math.abs(lb) > 0.24;
  const centralA = Math.abs(la) < 0.22;
  const centralB = Math.abs(lb) < 0.22;

  const defVsAtt =
    (rkA === "def" && (rkB === "fwd" || rkB === "mid")) ||
    (rkB === "def" && (rkA === "fwd" || rkA === "mid"));
  if (defVsAtt && laneMatch > 0.32) {
    score += wideA || wideB ? 16 : 9;
  }

  if (rkA === "mid" && rkB === "mid" && laneMatch > 0.42) {
    score += 11;
    if (wideA && wideB) score += 5;
  }

  if (
    ((rkA === "fwd" && rkB === "def") || (rkA === "def" && rkB === "fwd")) &&
    centralA &&
    centralB &&
    Math.abs(ya - yb) > 9
  ) {
    score += 13;
  }

  if (rkA === "def" && rkB === "def" && centralA && centralB) {
    score -= 15;
  }

  if (rkA === "fwd" && rkB === "fwd" && centralA && centralB) {
    score -= 9;
  }

  const pfA = lineupPositionFlank(athlete.positionCode);
  const pfB = lineupPositionFlank(opponent.positionCode);
  if (pfA !== 0 && pfB !== 0 && pfA === pfB && laneMatch > 0.4) {
    score += 6;
  }

  return clamp(score, 0, 40);
}

function frictionOverlapScore(
  athlete: SportPerformanceInput,
  opponent: SportPerformanceInput,
  homeTeamId?: number
): number {
  const aN = athlete.heatmapPoints.length;
  const bN = opponent.heatmapPoints.length;
  const foulsTrigger =
    athlete.foulsCommitted > 1.0 && opponent.foulsSuffered > 1.5 ? 1.25 : 1;

  const marking = markingAffinityScore(athlete, opponent, homeTeamId);

  if (aN >= MIN_HEATMAP_POINTS_FOR_SPATIAL && bN >= MIN_HEATMAP_POINTS_FOR_SPATIAL) {
    let distance: number;
    if (homeTeamId !== undefined && homeTeamId > 0) {
      distance = centroidDistance(
        normalizeHeatmapToHomeFrame(athlete.heatmapPoints, athlete.teamId, homeTeamId),
        normalizeHeatmapToHomeFrame(opponent.heatmapPoints, opponent.teamId, homeTeamId)
      );
    } else {
      const d1 = centroidDistance(
        athlete.heatmapPoints,
        mirrorHeatmapPointsX(opponent.heatmapPoints)
      );
      const d2 = centroidDistance(
        mirrorHeatmapPointsX(athlete.heatmapPoints),
        opponent.heatmapPoints
      );
      distance = Math.min(d1, d2);
    }
    const spatial = clamp(100 - distance, 0, 100);
    const foulBlend = foulFrictionScore(athlete, opponent);
    const combined = clamp(
      spatial * 0.56 + foulBlend * 0.22 + marking * 0.33,
      0,
      100
    );
    return combined * foulsTrigger;
  }

  const foulOnly = foulFrictionScore(athlete, opponent);
  return clamp(foulOnly * 0.82 + marking * 0.4, 0, 100) * foulsTrigger;
}

const HEATMAP_POINTS_RENDER_CAP = 72;

/** Numero leggibile per testi rivolti al pubblico (una cifra decimale). */
function fmtSimpleStat(n: number): string {
  return n.toFixed(1);
}

function capHeatmapPointsForPayload(
  points: SportPerformanceInput["heatmapPoints"]
): SportPerformanceInput["heatmapPoints"] {
  if (points.length <= HEATMAP_POINTS_RENDER_CAP) {
    return points;
  }
  const sorted = [...points].sort(
    (p, q) => (q.intensity ?? 1) - (p.intensity ?? 1)
  );
  return sorted.slice(0, HEATMAP_POINTS_RENDER_CAP);
}

/** Stesso frame usato per gli scontri friction (normalizzazione ospite), capped per il payload API. */
export function buildHeatmapPointsMatchFrameForPayload(
  points: SportPerformanceInput["heatmapPoints"],
  teamId: number,
  homeTeamId: number | undefined
): SportPerformanceInput["heatmapPoints"] {
  const inFrame =
    homeTeamId !== undefined && homeTeamId > 0
      ? normalizeHeatmapToHomeFrame(points, teamId, homeTeamId)
      : points;
  return capHeatmapPointsForPayload(inFrame);
}

function stableSeed01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function buildEstimatedHeatmapPoints(
  centerX: number,
  centerY: number,
  seed: string
): SportPerformanceInput["heatmapPoints"] {
  const s1 = stableSeed01(`${seed}:a`);
  const s2 = stableSeed01(`${seed}:b`);
  const dx = (s1 - 0.5) * 7.5;
  const dy = (s2 - 0.5) * 7.5;
  const pattern: Array<[number, number, number]> = [
    [0, 0, 1.0],
    [2.8, 1.6, 0.82],
    [-2.2, 1.2, 0.74],
    [1.9, -2.0, 0.68],
    [-1.7, -2.4, 0.62],
    [4.0, -0.4, 0.56]
  ];

  return pattern.map(([px, py, intensity]) => ({
    x: clamp(centerX + dx + px, 2, 98),
    y: clamp(centerY + dy + py, 2, 98),
    intensity
  }));
}

function buildFrictionExplanation(
  athlete: SportPerformanceInput,
  opponent: SportPerformanceInput,
  heatmapOk: boolean,
  markingScore: number
): string {
  const aName = athlete.athleteName;
  const bName = opponent.athleteName;
  const aFc = athlete.foulsCommittedSeasonAvg;
  const aFs = athlete.foulsSufferedSeasonAvg;
  const bFc = opponent.foulsCommittedSeasonAvg;
  const bFs = opponent.foulsSufferedSeasonAvg;

  const foulsBlock =
    `${aName}: in media circa ${fmtSimpleStat(aFc)} falli commessi e ${fmtSimpleStat(aFs)} subiti a partita in campionato. ` +
    `${bName}: circa ${fmtSimpleStat(bFc)} commessi e ${fmtSimpleStat(bFs)} subiti. `;

  const markingBlock =
    markingScore >= 16
      ? "Dal profilo tattico (fascia di campo dalle heatmap, ruoli e posizione in formazione) emerge un incrocio compatibile con una marcatura diretta sulle corsie — ad esempio esterno contro terzino, o centrocampista spostato su un lato contro l’ala avversaria. "
      : markingScore >= 9
        ? "Ruoli e fasce laterali suggeriscono un duello plausibile sulla stessa metà campo, oltre alla sola vicinanza delle heatmap. "
        : "";

  if (heatmapOk) {
    return (
      foulsBlock +
      markingBlock +
      "Le heatmap stagionali indicano zone di campo vicine o sovrapposte: è plausibile che in partita si incrocino spesso nello stesso settore."
    );
  }

  return (
    foulsBlock +
    (markingBlock ||
      "I dati di posizione sul campo sono parziali; il quadro resta guidato soprattutto dalle medie sui falli.")
  );
}

function roleToIcon(role: string): TacticalMetrics["roleIcon"] {
  const normalized = role.toLowerCase();
  if (normalized.includes("goal")) return "🧤";
  if (normalized.includes("def")) return "🛡️";
  if (normalized.includes("for") || normalized.includes("att")) return "🎯";
  return "⚡";
}

function calculateFirepowerIndex(athlete: SportPerformanceInput): {
  index: number;
  deltaPct: number;
  editorial: string | null;
} {
  const lastTwo = athlete.shotsLastTwoAvg;
  const seasonal = Math.max(athlete.shotsSeasonAvg, 0.1);
  const momentumRatio = lastTwo / seasonal;
  const opponentFactor =
    athlete.opponentShotsConcededTotal / Math.max(athlete.leagueAvgShotsConceded, 0.1);

  const index = clamp(momentumRatio * 70 + opponentFactor * 30);
  const deltaPct = (momentumRatio - 1) * 100;
  const editorial =
    index > 80
      ? `ASSETTO OFFENSIVO: Volume di tiro in crescita (+${deltaPct.toFixed(1)}%)`
      : null;

  return { index, deltaPct, editorial };
}

function calculateSparkDetector(
  athlete: SportPerformanceInput,
  nearbyAthletes: SportPerformanceInput[],
  homeTeamId?: number
): {
  index: number;
  narrative: string;
  zone: TacticalMetrics["sparkZone"];
  duel: TacticalMetrics["sparkDuel"];
  frictionExplanation: string | null;
  frictionHeatmap: TacticalMetrics["sparkFrictionHeatmap"];
} {
  if (!nearbyAthletes.length) {
    return {
      index: clamp(athlete.foulsCommitted * 20),
      narrative: "Non emerge un avversario con profilo di contrasto particolarmente marcato.",
      zone: { x: 50, y: 50, glow: 0 },
      duel: null,
      frictionExplanation: null,
      frictionHeatmap: null
    };
  }

  const bestOpponent = nearbyAthletes
    .map((opponent) => ({
      opponent,
      overlap: frictionOverlapScore(athlete, opponent, homeTeamId)
    }))
    .sort((a, b) => b.overlap - a.overlap)[0];

  const opp = bestOpponent.opponent;
  const useHomePitchFrame = homeTeamId !== undefined && homeTeamId > 0;
  const athleteZonePoints = useHomePitchFrame
    ? normalizeHeatmapToHomeFrame(athlete.heatmapPoints, athlete.teamId, homeTeamId)
    : athlete.heatmapPoints;
  const hasSpatialZone = athleteZonePoints.length >= MIN_HEATMAP_POINTS_FOR_SPATIAL;
  const c = heatmapCentroid(athleteZonePoints);
  const index = clamp(bestOpponent.overlap);
  const zone = {
    x: hasSpatialZone ? clamp(c.x, 0, 100) : 50,
    y: hasSpatialZone ? clamp(c.y, 0, 100) : 50,
    glow: index
  };

  const duel = {
    playerA: athlete.athleteName,
    playerB: opp.athleteName,
    playerAId: athlete.athleteId,
    playerBId: opp.athleteId,
    foulsCommittedA: athlete.foulsCommitted,
    foulsSufferedB: opp.foulsSuffered
  };

  const aN = athlete.heatmapPoints.length;
  const bN = opp.heatmapPoints.length;
  const heatmapOk =
    aN >= MIN_HEATMAP_POINTS_FOR_SPATIAL && bN >= MIN_HEATMAP_POINTS_FOR_SPATIAL;

  const markingScore = markingAffinityScore(athlete, opp, homeTeamId);
  const narrative =
    markingScore >= 16
      ? `Possibile scontro in campo tra ${athlete.athleteName} e ${opp.athleteName}, con profilo da duello tattico sulla stessa fascia (marcatura plausibile).`
      : `Possibile scontro in campo tra ${athlete.athleteName} e ${opp.athleteName}.`;

  const frictionExplanation = buildFrictionExplanation(athlete, opp, heatmapOk, markingScore);

  const oppPointsForDisplay = useHomePitchFrame
    ? opp.heatmapPoints.length > 0
      ? normalizeHeatmapToHomeFrame(opp.heatmapPoints, opp.teamId, homeTeamId)
      : []
    : opp.heatmapPoints.length > 0
      ? mirrorHeatmapPointsX(opp.heatmapPoints)
      : [];
  const oppCentroid = heatmapCentroid(oppPointsForDisplay);
  const athletePointsForDisplay = useHomePitchFrame
    ? athlete.heatmapPoints.length > 0
      ? normalizeHeatmapToHomeFrame(athlete.heatmapPoints, athlete.teamId, homeTeamId)
      : []
    : athlete.heatmapPoints;
  const pointsA =
    athletePointsForDisplay.length > 0
      ? capHeatmapPointsForPayload(athletePointsForDisplay)
      : buildEstimatedHeatmapPoints(zone.x, zone.y, `${athlete.athleteName}|${opp.athleteName}|A`);
  const pointsB =
    oppPointsForDisplay.length > 0
      ? capHeatmapPointsForPayload(oppPointsForDisplay)
      : buildEstimatedHeatmapPoints(
          oppCentroid.x > 0 || oppCentroid.y > 0 ? oppCentroid.x : zone.x + 3.5,
          oppCentroid.x > 0 || oppCentroid.y > 0 ? oppCentroid.y : zone.y - 1.5,
          `${athlete.athleteName}|${opp.athleteName}|B`
        );

  const frictionHeatmap: TacticalMetrics["sparkFrictionHeatmap"] = {
    labelA: athlete.athleteName,
    labelB: opp.athleteName,
    clubColorA: athlete.clubColor || "#38bdf8",
    clubColorB: opp.clubColor || "#c084fc",
    pointsA,
    pointsB
  };

  return { index, narrative, zone, duel, frictionExplanation, frictionHeatmap };
}

function calculateWallIndex(athlete: SportPerformanceInput): number {
  const xgPressure = clamp(athlete.opponentExpectedGoalsCreated * 40);
  const saveRate = athlete.savePercentage > 1 ? athlete.savePercentage / 100 : athlete.savePercentage;
  const keeperVulnerability = clamp((1 - saveRate) * 100);
  return clamp(xgPressure * 0.6 + keeperVulnerability * 0.4);
}

function avgShotsConcededByTeam(team: string, rows: SportPerformanceInput[]): number {
  const teammates = rows.filter((row) => row.team === team);
  if (!teammates.length) return 0;
  return (
    teammates.reduce((acc, row) => acc + row.opponentShotsConcededTotal, 0) /
    teammates.length
  );
}

export function buildTacticalMetrics(
  athlete: SportPerformanceInput,
  allAthletes: SportPerformanceInput[],
  options?: { homeTeamId?: number }
): TacticalMetrics {
  const nearbyAthletes = allAthletes.filter((opponent) => opponent.team !== athlete.team);
  const firepower = calculateFirepowerIndex(athlete);
  const spark = calculateSparkDetector(athlete, nearbyAthletes, options?.homeTeamId);
  const wallIndex = calculateWallIndex(athlete);

  return {
    playerId: athlete.athleteId,
    playerName: athlete.athleteName.toUpperCase(),
    jerseyNumber: athlete.jerseyNumber,
    roleIcon: roleToIcon(athlete.role),
    team: athlete.team,
    teamId: athlete.teamId,
    clubColor: athlete.clubColor,
    firepowerIndex: firepower.index,
    firepowerDeltaPct: firepower.deltaPct,
    firepowerEditorial: firepower.editorial,
    sparkIndex: spark.index,
    sparkNarrative: spark.narrative,
    sparkFrictionExplanation: spark.frictionExplanation,
    sparkFrictionHeatmap: spark.frictionHeatmap,
    sparkZone: spark.zone,
    sparkDuel: spark.duel,
    wallIndex: clamp(wallIndex + avgShotsConcededByTeam(athlete.team, allAthletes) * 0.05),
    shotsSeasonAvg: athlete.shotsSeasonAvg,
    shotsLastTwoAvg: athlete.shotsLastTwoAvg,
    shotsLastFiveAvg: athlete.shotsLastFiveAvg,
    savesSeasonAvg: athlete.savesSeasonAvg,
    savesLastTwoAvg: athlete.savesLastTwoAvg,
    savesLastFiveAvg: athlete.savesLastFiveAvg,
    opponentShotsOnTargetSeasonAvg: athlete.opponentShotsOnTargetSeasonAvg,
    opponentShotsOnTargetLeagueAvg: athlete.opponentShotsOnTargetLeagueAvg,
    opponentShotsOnTargetLastTwoAvg: athlete.opponentShotsOnTargetLastTwoAvg,
    opponentShotsOnTargetLastTwoLeagueAvg: athlete.opponentShotsOnTargetLastTwoLeagueAvg,
    foulsCommittedSeasonAvg: athlete.foulsCommittedSeasonAvg,
    foulsCommittedLastTwoAvg: athlete.foulsCommittedLastTwoAvg,
    foulsCommittedLastFiveAvg: athlete.foulsCommittedLastFiveAvg,
    foulsSufferedSeasonAvg: athlete.foulsSufferedSeasonAvg,
    foulsSufferedLastTwoAvg: athlete.foulsSufferedLastTwoAvg,
    foulsSufferedLastFiveAvg: athlete.foulsSufferedLastFiveAvg,
    shotsLastTwoSampleCount: athlete.shotsLastTwoSampleCount,
    savesLastTwoSampleCount: athlete.savesLastTwoSampleCount,
    foulsCommittedLastTwoSampleCount: athlete.foulsCommittedLastTwoSampleCount,
    foulsSufferedLastTwoSampleCount: athlete.foulsSufferedLastTwoSampleCount,
    shotsLastFiveSampleCount: athlete.shotsLastFiveSampleCount,
    savesLastFiveSampleCount: athlete.savesLastFiveSampleCount,
    foulsCommittedLastFiveSampleCount: athlete.foulsCommittedLastFiveSampleCount,
    foulsSufferedLastFiveSampleCount: athlete.foulsSufferedLastFiveSampleCount,
    lastUpdated: new Date().toISOString(),
    heatmapPointsMatchFrame: buildHeatmapPointsMatchFrameForPayload(
      athlete.heatmapPoints,
      athlete.teamId,
      options?.homeTeamId
    )
  };
}
