import type { SparkFrictionHeatmapPayload, TacticalMetrics } from "@/lib/types";

export type FoulRiskAnalysisKind = "suffered" | "committed";

export interface FoulRiskAggressorBrief {
  playerName: string;
  team: string;
  collisionPercent: number;
  foulsCommittedSeasonAvg: number;
  foulsSufferedSeasonAvg: number;
}

export interface FoulRiskEntry {
  playerId?: number;
  playerName: string;
  team: string;
  teamId: number;
  clubColor: string;
  kind: FoulRiskAnalysisKind;
  riskScore: number;
  maxCollisionPercent: number;
  aggressors: FoulRiskAggressorBrief[];
  heatmap: SparkFrictionHeatmapPayload;
  justification: string;
}

const GRID = 20;
const GAUSS_SIGMA = 1.15;
const DEAD_CELL_SUM = 0.02;
const MIN_HEATMAP_POINTS = 3;
const MIN_COLLISION_PERCENT = 10;
const FOUL_TRIGGER = 1.0;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rasterizeHeatmap(
  points: Array<{ x: number; y: number; intensity?: number }>
): Float64Array {
  const g = new Float64Array(GRID * GRID);
  for (const p of points) {
    const w = p.intensity ?? 1;
    const cx = (clamp(p.x, 0, 100) / 100) * GRID;
    const cy = (clamp(p.y, 0, 100) / 100) * GRID;
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const dist = Math.hypot(dx, dy);
        if (dist > 3.1) continue;
        const ix = Math.floor(cx + dx);
        const iy = Math.floor(cy + dy);
        if (ix < 0 || iy < 0 || ix >= GRID || iy >= GRID) continue;
        const contrib = w * Math.exp(-(dist * dist) / (2 * GAUSS_SIGMA * GAUSS_SIGMA));
        g[iy * GRID + ix] += contrib;
      }
    }
  }
  return g;
}

/** Sovrapposizione normalizzata 0–100: ignora celle con densità combinata trascurabile (“zone morte”). */
function collisionPercent(a: Float64Array, b: Float64Array): number {
  let overlap = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const va = a[i];
    const vb = b[i];
    if (va + vb < DEAD_CELL_SUM) continue;
    overlap += Math.min(va, vb);
    sa += va;
    sb += vb;
  }
  const den = Math.max(sa, sb, 1e-9);
  return clamp((overlap / den) * 100, 0, 100);
}

function mergeAggressorPoints(
  aggressors: TacticalMetrics[],
  maxPointsTotal: number
): Array<{ x: number; y: number; intensity?: number }> {
  const out: Array<{ x: number; y: number; intensity?: number }> = [];
  for (const ag of aggressors) {
    const pts = ag.heatmapPointsMatchFrame ?? [];
    for (const p of pts) {
      if (out.length >= maxPointsTotal) return out;
      out.push({
        x: p.x,
        y: p.y,
        intensity: (p.intensity ?? 1) * 0.92
      });
    }
  }
  return out;
}

function buildJustification(
  target: TacticalMetrics,
  kind: FoulRiskAnalysisKind,
  collisionPct: number,
  aggressors: FoulRiskAggressorBrief[]
): string {
  if (aggressors.length === 0) return "";
  const names = aggressors.map((a) => a.playerName.trim()).filter(Boolean);
  const list =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} e ${names[1]}`
        : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  const pct = collisionPct.toFixed(0);

  if (kind === "suffered") {
    const avgc = aggressors
      .reduce((s, a) => s + a.foulsCommittedSeasonAvg, 0)
      / Math.max(1, aggressors.length);
    return (
      `${target.playerName} risulta esposto a contatti ravvicinati: la sua zona di azione stagionale si sovrappone per circa il ${pct}% ` +
      `con l’area di pressione di ${list}, con media falli commessi in campionato intorno a ${avgc.toFixed(1)} a partita ` +
      `(soglia attivazione > ${FOUL_TRIGGER.toFixed(2)}).`
    );
  }

  const avgs = aggressors.reduce((s, a) => s + a.foulsSufferedSeasonAvg, 0) / Math.max(1, aggressors.length);
  return (
    `${target.playerName} può entrare spesso in duello fisico: la heatmap stagionale coincide per circa il ${pct}% ` +
    `con zone occupate da ${list}, avversari che subiscono in media circa ${avgs.toFixed(1)} falli a partita ` +
    `(soglia > ${FOUL_TRIGGER.toFixed(2)}), segnale di contestazione frequente.`
  );
}

/**
 * Analisi predittiva “giocatori a rischio falli” usando solo `heatmapPointsMatchFrame` già normalizzate al frame casa
 * (nessuna nuova chiamata API).
 */
export function analyzeFoulRisk(params: {
  metrics: TacticalMetrics[];
  homeTeamId: number;
  awayTeamId: number;
  kind: FoulRiskAnalysisKind;
}): FoulRiskEntry[] {
  const { metrics, homeTeamId, awayTeamId, kind } = params;
  const teamIds = new Set([homeTeamId, awayTeamId]);
  const players = metrics.filter(
    (m) => teamIds.has(m.teamId) && m.roleIcon !== "🧤" && (m.heatmapPointsMatchFrame?.length ?? 0) >= MIN_HEATMAP_POINTS
  );

  const results: FoulRiskEntry[] = [];

  for (const p1 of players) {
    const opponents = players.filter((m) => m.teamId !== p1.teamId);
    const grid1 = rasterizeHeatmap(p1.heatmapPointsMatchFrame ?? []);

    const hits: Array<{
      opp: TacticalMetrics;
      c: number;
    }> = [];

    for (const p2 of opponents) {
      const pts = p2.heatmapPointsMatchFrame ?? [];
      if (pts.length < MIN_HEATMAP_POINTS) continue;
      const c = collisionPercent(grid1, rasterizeHeatmap(pts));
      if (c < MIN_COLLISION_PERCENT) continue;

      if (kind === "suffered") {
        if (p2.foulsCommittedSeasonAvg > FOUL_TRIGGER) {
          hits.push({ opp: p2, c });
        }
      } else if (p2.foulsSufferedSeasonAvg > FOUL_TRIGGER) {
        hits.push({ opp: p2, c });
      }
    }

    if (hits.length === 0) continue;

    hits.sort((a, b) => b.c - a.c);
    const topHits = hits.slice(0, 4);
    const maxC = topHits[0]?.c ?? 0;

    const foulExcess =
      kind === "suffered"
        ? Math.max(...topHits.map((h) => h.opp.foulsCommittedSeasonAvg - FOUL_TRIGGER), 0)
        : Math.max(...topHits.map((h) => h.opp.foulsSufferedSeasonAvg - FOUL_TRIGGER), 0);

    const riskScore = maxC * (1 + 0.12 * foulExcess);

    const aggressors: FoulRiskAggressorBrief[] = topHits.map((h) => ({
      playerName: h.opp.playerName,
      team: h.opp.team,
      collisionPercent: Math.round(h.c * 10) / 10,
      foulsCommittedSeasonAvg: h.opp.foulsCommittedSeasonAvg,
      foulsSufferedSeasonAvg: h.opp.foulsSufferedSeasonAvg
    }));

    const oppModels = topHits.map((h) => h.opp);
    const pointsB = mergeAggressorPoints(oppModels, 72);

    const heatmap: SparkFrictionHeatmapPayload = {
      labelA: p1.playerName,
      labelB:
        oppModels.length === 1
          ? oppModels[0].playerName
          : `${oppModels.length} avversari — pressione`,
      clubColorA: p1.clubColor || "#38bdf8",
      clubColorB: oppModels[0]?.clubColor || "#c084fc",
      pointsA: p1.heatmapPointsMatchFrame ?? [],
      pointsB: pointsB.length > 0 ? pointsB : (oppModels[0]?.heatmapPointsMatchFrame ?? [])
    };

    results.push({
      playerId: p1.playerId,
      playerName: p1.playerName,
      team: p1.team,
      teamId: p1.teamId,
      clubColor: p1.clubColor,
      kind,
      riskScore,
      maxCollisionPercent: Math.round(maxC * 10) / 10,
      aggressors,
      heatmap,
      justification: buildJustification(p1, kind, maxC, aggressors)
    });
  }

  results.sort((a, b) => b.riskScore - a.riskScore);
  return results;
}
