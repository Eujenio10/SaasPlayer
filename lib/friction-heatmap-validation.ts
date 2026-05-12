import type { SparkFrictionHeatmapPayload } from "@/lib/types";

/** Pochi punti ⇒ centroidi/spread instabili; non si mostra la heatmap duello al pubblico. */
const MIN_POINTS_EACH = 10;
/** Dispersione minima ponderata sul campo [0–100] (rms per asse sul baricentro pesato per intensità). */
const MIN_RMS_HALF_AXIS = 7.25;
/** Distanza dalla metà campo oltre cui consideriamo “non tutto centrato sul cerchio di centrocampo”. */
const CENTRE_CLUSTER_RADIUS = 14;

type Pt = SparkFrictionHeatmapPayload["pointsA"][number];

function heatmapCentroid(points: Pt[]): { x: number; y: number } {
  if (!points.length) return { x: 50, y: 50 };
  let tx = 0;
  let ty = 0;
  let tw = 0;
  for (const p of points) {
    const w = p.intensity ?? 1;
    tw += w;
    tx += p.x * w;
    ty += p.y * w;
  }
  if (tw < 1e-9) return { x: 50, y: 50 };
  return { x: tx / tw, y: ty / tw };
}

function weightedRmsHalfAxes(points: Pt[]): { rx: number; ry: number } {
  const c = heatmapCentroid(points);
  let tw = 0;
  let vx = 0;
  let vy = 0;
  for (const p of points) {
    const w = p.intensity ?? 1;
    tw += w;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    vx += w * dx * dx;
    vy += w * dy * dy;
  }
  if (tw < 1e-9) return { rx: 0, ry: 0 };
  return { rx: Math.sqrt(vx / tw), ry: Math.sqrt(vy / tw) };
}

/**
 * Fascia da codice ruolo/formazione (-1 sinistra, +1 destra, 0 centro/ignoto).
 * Allineato a `lineupPositionFlank` in `predictive.ts`.
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

/** True se si può mostrare sullo schermo duello una heatmap seria (solo dati reali, dispersi abbastanza). */
export function frictionHeatmapIsTrustedForUi(
  payload: SparkFrictionHeatmapPayload | null | undefined,
  opts?: { positionCodeA?: string; positionCodeB?: string }
): payload is SparkFrictionHeatmapPayload {
  if (!payload?.pointsA?.length || !payload.pointsB?.length) return false;
  if (payload.pointsA.length < MIN_POINTS_EACH || payload.pointsB.length < MIN_POINTS_EACH) {
    return false;
  }

  const { rx: rxA, ry: ryA } = weightedRmsHalfAxes(payload.pointsA);
  const { rx: rxB, ry: ryB } = weightedRmsHalfAxes(payload.pointsB);
  const spreadA = Math.max(rxA, ryA);
  const spreadB = Math.max(rxB, ryB);
  if (spreadA < MIN_RMS_HALF_AXIS || spreadB < MIN_RMS_HALF_AXIS) {
    return false;
  }

  const ca = heatmapCentroid(payload.pointsA);
  const cb = heatmapCentroid(payload.pointsB);
  /** Cluster “solo cerchio di centrocampo”: centroidi centrati ma poca dispersione reale (< ~9%). */
  const centreStuckBoth =
    Math.hypot(ca.x - 50, ca.y - 50) <= CENTRE_CLUSTER_RADIUS &&
    Math.hypot(cb.x - 50, cb.y - 50) <= CENTRE_CLUSTER_RADIUS &&
    spreadA < 9 &&
    spreadB < 9;

  /* Pattern tipico placeholder / estrazioni errate ravvicinate al centro. */
  if (centreStuckBoth) return false;

  const flankA = lineupPositionFlank(opts?.positionCodeA);
  const flankB = lineupPositionFlank(opts?.positionCodeB);
  const hBiasA = Math.abs(ca.x - 50) / 50;
  const hBiasB = Math.abs(cb.x - 50) / 50;

  /* Formazione su fascia marcata ma mappe ancora quasi centrali ⇒ probabile estrazione errata. */
  if (flankA !== 0 && hBiasA < 0.11 && spreadA < 12) return false;
  if (flankB !== 0 && hBiasB < 0.11 && spreadB < 12) return false;

  return true;
}
