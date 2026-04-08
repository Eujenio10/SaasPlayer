import type { SportPerformanceInput, TacticalMetrics } from "@/lib/types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ribalta la coordinata X sul campo 0–100 (asse lungo: porta–porta), per sovrapporre due profili
 * quando i dati stagionali sono espressi come “attacco verso destra” per entrambe le squadre.
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
 * Porta tutti i punti nel sistema di riferimento della squadra di casa (stesso orientamento della
 * partita in diretta): la heatmap dei giocatori in trasferta viene ribaltata lungo l'asse lungo,
 * così terzini/esterni avversari non risultano sovrapposti per errore pur occupando fasce opposte.
 */
function normalizeHeatmapToHomeFrame(
  points: SportPerformanceInput["heatmapPoints"],
  teamId: number,
  homeTeamId: number
): SportPerformanceInput["heatmapPoints"] {
  if (!points.length) return points;
  if (teamId === homeTeamId) return points;
  return mirrorHeatmapPointsX(points);
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

function frictionOverlapScore(
  athlete: SportPerformanceInput,
  opponent: SportPerformanceInput,
  homeTeamId?: number
): number {
  const aN = athlete.heatmapPoints.length;
  const bN = opponent.heatmapPoints.length;
  const foulsTrigger =
    athlete.foulsCommitted > 1.0 && opponent.foulsSuffered > 1.5 ? 1.25 : 1;

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
    return (spatial * 0.72 + foulBlend * 0.28) * foulsTrigger;
  }

  return foulFrictionScore(athlete, opponent) * foulsTrigger;
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
  alignedToHomePitchFrame: boolean
): string {
  const aName = athlete.athleteName;
  const bName = opponent.athleteName;
  const aFc = athlete.foulsCommittedSeasonAvg;
  const bFs = opponent.foulsSufferedSeasonAvg;

  const base =
    `${aName} in campionato commette in media circa ${fmtSimpleStat(aFc)} falli a partita; ` +
    `${bName} ne subisce in media circa ${fmtSimpleStat(bFs)}. ` +
    "Da qui il possibile contrasto fisico in campo.";

  if (heatmapOk) {
    let spatial =
      " La mappa mostra dove sono stati più presenti sul terreno in stagione: dove i colori si avvicinano, le loro zone di gioco si sovrappongono.";
    if (alignedToHomePitchFrame) {
      spatial +=
        " Per il confronto sull’incontro, la heatmap della squadra ospite è stata ribaltata lungo l’asse lungo del campo (come in diretta dalla parte della casa), così le due mappe sono nello stesso sistema di riferimento e non si sovrappongono per errore su fasce opposte.";
    }
    return base + spatial;
  }

  return base + " I dati di posizione sul campo sono parziali: il quadro si completa soprattutto con le medie sui falli.";
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

  const narrative = `Possibile scontro in campo tra ${athlete.athleteName} e ${opp.athleteName}.`;

  const frictionExplanation = buildFrictionExplanation(
    athlete,
    opp,
    heatmapOk,
    useHomePitchFrame
  );

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
    savesSeasonAvg: athlete.savesSeasonAvg,
    savesLastTwoAvg: athlete.savesLastTwoAvg,
    opponentShotsOnTargetSeasonAvg: athlete.opponentShotsOnTargetSeasonAvg,
    opponentShotsOnTargetLeagueAvg: athlete.opponentShotsOnTargetLeagueAvg,
    opponentShotsOnTargetLastTwoAvg: athlete.opponentShotsOnTargetLastTwoAvg,
    opponentShotsOnTargetLastTwoLeagueAvg: athlete.opponentShotsOnTargetLastTwoLeagueAvg,
    foulsCommittedSeasonAvg: athlete.foulsCommittedSeasonAvg,
    foulsCommittedLastTwoAvg: athlete.foulsCommittedLastTwoAvg,
    foulsSufferedSeasonAvg: athlete.foulsSufferedSeasonAvg,
    foulsSufferedLastTwoAvg: athlete.foulsSufferedLastTwoAvg,
    shotsLastTwoSampleCount: athlete.shotsLastTwoSampleCount,
    savesLastTwoSampleCount: athlete.savesLastTwoSampleCount,
    foulsCommittedLastTwoSampleCount: athlete.foulsCommittedLastTwoSampleCount,
    foulsSufferedLastTwoSampleCount: athlete.foulsSufferedLastTwoSampleCount,
    lastUpdated: new Date().toISOString()
  };
}
