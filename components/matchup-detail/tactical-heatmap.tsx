import { useId, useMemo } from "react";
import { frictionHeatmapIsTrustedForUi } from "@/lib/friction-heatmap-validation";
import type { SparkFrictionHeatmapPayload } from "@/lib/types";
import { HeatmapLegend } from "./heatmap-legend";
import { MATCHUP_COLORS } from "./matchup-mapping";

const VB_W = 105;
const VB_H = 68;

/** Risoluzione griglia nello spazio campo 0–100 (indipendente dall’aspect SVG). */
const GRID_NX = 28;
const GRID_NY = 18;
/** Larghezza kernel gaussiano (~% campo): più alto = nuvole più morbide. */
const SIGMA = 12;

const OVERLAP_HIGH = "#DC2626";
const OVERLAP_MID = "#EA580C";
const OVERLAP_LOW = "#22C55E";

type Pt = SparkFrictionHeatmapPayload["pointsA"][number];

function maxIntensity(points: Pt[]): number {
  let m = 1;
  for (const p of points) {
    const w = p.intensity ?? 1;
    if (w > m) m = w;
  }
  return m;
}

function gaussianSum(points: Pt[], cx: number, cy: number, gMax: number, sigma: number): number {
  const s2 = 2 * sigma * sigma;
  let s = 0;
  for (const p of points) {
    const w = (p.intensity ?? 1) / gMax;
    const dx = p.x - cx;
    const dy = p.y - cy;
    s += w * Math.exp(-(dx * dx + dy * dy) / s2);
  }
  return s;
}

type CellRect = {
  key: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  fill: string;
  opacity: number;
};

function buildHeatmapLayers(pointsA: Pt[], pointsB: Pt[], gMax: number): { cells: CellRect[] } {
  const nx = GRID_NX;
  const ny = GRID_NY;

  const dA: number[] = new Array(nx * ny);
  const dB: number[] = new Array(nx * ny);
  let maxA = 1e-9;
  let maxB = 1e-9;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = ((i + 0.5) / nx) * 100;
      const cy = ((j + 0.5) / ny) * 100;
      const idx = j * nx + i;
      const a = pointsA.length ? gaussianSum(pointsA, cx, cy, gMax, SIGMA) : 0;
      const b = pointsB.length ? gaussianSum(pointsB, cx, cy, gMax, SIGMA) : 0;
      dA[idx] = a;
      dB[idx] = b;
      if (a > maxA) maxA = a;
      if (b > maxB) maxB = b;
    }
  }

  const overlaps: number[] = [];
  const oGrid: number[] = new Array(nx * ny);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const an = dA[idx]! / maxA;
      const bn = dB[idx]! / maxB;
      /* Prodotto: richiede presenza di entrambi; radice ammorbidisce le code. */
      const o = Math.sqrt(Math.max(0, an * bn));
      oGrid[idx] = o;
      if (o > 1e-6) overlaps.push(o);
    }
  }

  const cells: CellRect[] = [];

  if (overlaps.length === 0) {
    const cw = VB_W / nx;
    const ch = VB_H / ny;
    const pad = 0.05 * Math.min(cw, ch);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        const an = dA[idx]! / maxA;
        const bn = dB[idx]! / maxB;
        const sx = i * cw + pad * 0.5;
        const sy = j * ch + pad * 0.5;
        const sw = cw - pad;
        const sh = ch - pad;
        if (an > 0.14 && an > bn * 1.45) {
          cells.push({
            key: `a-${i}-${j}`,
            sx,
            sy,
            sw,
            sh,
            fill: MATCHUP_COLORS.blue,
            opacity: 0.12
          });
        } else if (bn > 0.14 && bn > an * 1.45) {
          cells.push({
            key: `b-${i}-${j}`,
            sx,
            sy,
            sw,
            sh,
            fill: MATCHUP_COLORS.red,
            opacity: 0.12
          });
        }
      }
    }
    return { cells };
  }

  overlaps.sort((a, b) => a - b);
  const maxO = overlaps[overlaps.length - 1]!;
  let minVis = Math.max(maxO * 0.04, overlaps[Math.min(overlaps.length - 1, Math.floor(overlaps.length * 0.06))]!);

  let sig = overlaps.filter((v) => v >= minVis);
  if (sig.length === 0) {
    minVis = overlaps[0]!;
    sig = overlaps;
  }

  const pickq = (sorted: number[], q: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;

  const tHighEff = pickq(sig, 0.68);
  let tMidEff = pickq(sig, 0.36);
  if (tMidEff >= tHighEff - 1e-8) {
    tMidEff = minVis + Math.max(1e-6, (tHighEff - minVis) * 0.42);
  }

  const cw = VB_W / nx;
  const ch = VB_H / ny;
  const pad = 0.05 * Math.min(cw, ch);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const an = dA[idx]! / maxA;
      const bn = dB[idx]! / maxB;
      const o = oGrid[idx]!;

      const sx = i * cw + pad * 0.5;
      const sy = j * ch + pad * 0.5;
      const sw = cw - pad;
      const sh = ch - pad;

      if (o >= minVis) {
        let fill: string;
        let opacity: number;
        if (o >= tHighEff) {
          fill = OVERLAP_HIGH;
          opacity = 0.72;
        } else if (o >= tMidEff) {
          fill = OVERLAP_MID;
          opacity = 0.52;
        } else {
          fill = OVERLAP_LOW;
          opacity = 0.38;
        }
        cells.push({ key: `o-${i}-${j}`, sx, sy, sw, sh, fill, opacity });
        continue;
      }

      /* Dove non c’è sovrapposizione significativa, accenno leggero alle zone “prevalenti” dei due. */
      if (an > 0.14 && an > bn * 1.45) {
        cells.push({
          key: `a-${i}-${j}`,
          sx,
          sy,
          sw,
          sh,
          fill: MATCHUP_COLORS.blue,
          opacity: 0.1
        });
      } else if (bn > 0.14 && bn > an * 1.45) {
        cells.push({
          key: `b-${i}-${j}`,
          sx,
          sy,
          sw,
          sh,
          fill: MATCHUP_COLORS.red,
          opacity: 0.1
        });
      }
    }
  }

  return { cells };
}

interface TacticalHeatmapProps {
  heatmap: SparkFrictionHeatmapPayload | null;
  /** Per coerenza con la validazione lato insights (fascie vs centroidi vicini al centro). */
  positionCodesForTrust?: { positionCodeA?: string; positionCodeB?: string };
}

export function TacticalHeatmap({ heatmap, positionCodesForTrust }: TacticalHeatmapProps) {
  const uid = useId().replace(/:/g, "");

  const labelA = heatmap?.labelA ?? "Giocatore A";
  const labelB = heatmap?.labelB ?? "Giocatore B";
  const pointsA = heatmap?.pointsA ?? [];
  const pointsB = heatmap?.pointsB ?? [];

  const showHeatmap = useMemo(() => {
    return frictionHeatmapIsTrustedForUi(heatmap ?? null, {
      positionCodeA: positionCodesForTrust?.positionCodeA,
      positionCodeB: positionCodesForTrust?.positionCodeB
    });
  }, [
    heatmap,
    positionCodesForTrust?.positionCodeA,
    positionCodesForTrust?.positionCodeB
  ]);

  const empty =
    Boolean(heatmap) && showHeatmap && pointsA.length === 0 && pointsB.length === 0;

  const { cells } = useMemo(() => {
    if (!heatmap || !showHeatmap) {
      return { cells: [] as CellRect[] };
    }
    const pa = heatmap.pointsA ?? [];
    const pb = heatmap.pointsB ?? [];
    if (pa.length === 0 && pb.length === 0) {
      return { cells: [] as CellRect[] };
    }
    const gMaxInner = Math.max(maxIntensity(pa), maxIntensity(pb), 1);
    return buildHeatmapLayers(pa, pb, gMaxInner);
  }, [heatmap, showHeatmap]);

  const clipId = `pitchClip-${uid}`;
  const gradShade = `pitchShade-${uid}`;
  const blurId = `overlapBlur-${uid}`;

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl border border-[rgba(120,170,255,0.18)] shadow-[inset_0_0_70px_rgba(0,0,0,0.45)]"
        style={{
          aspectRatio: `${VB_W} / ${VB_H}`
        }}
      >
        {!heatmap || !showHeatmap ? (
          <div className="flex h-full min-h-[200px] items-center justify-center bg-[#040B14] px-6 text-center text-sm leading-relaxed text-[#94A3B8]">
            Heatmap non disponibile per questo scontro
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="block h-full w-full bg-[#040B14]"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Mappa semplificata zona di scontro tra ${labelA} e ${labelB}`}
          >
            <title>Mappa: {labelA} vs {labelB}</title>
            <defs>
              <linearGradient id={gradShade} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#07111f" />
                <stop offset="55%" stopColor="#040B14" />
                <stop offset="100%" stopColor="#02060d" />
              </linearGradient>
              <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.55" />
              </filter>
              <clipPath id={clipId}>
                <rect x="0.5" y="0.5" width={VB_W - 1} height={VB_H - 1} rx="1.6" ry="1.6" />
              </clipPath>
            </defs>

            <g clipPath={`url(#${clipId})`}>
              <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${gradShade})`} />

              {!empty ? (
                <g filter={`url(#${blurId})`} style={{ mixBlendMode: "normal" }}>
                  {cells.map((c) => (
                    <rect
                      key={c.key}
                      x={c.sx}
                      y={c.sy}
                      width={c.sw}
                      height={c.sh}
                      rx={0.35}
                      ry={0.35}
                      fill={c.fill}
                      fillOpacity={c.opacity}
                    />
                  ))}
                </g>
              ) : (
                <text
                  x={VB_W / 2}
                  y={VB_H / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="rgba(148,163,184,0.85)"
                  fontSize="3.6"
                  className="select-none"
                >
                  Punti heatmap insufficienti
                </text>
              )}

              <rect
                x="0.4"
                y="0.4"
                width={VB_W - 0.8}
                height={VB_H - 0.8}
                rx="1.55"
                ry="1.55"
                fill="none"
                stroke="rgba(248,250,252,0.52)"
                strokeWidth="0.35"
              />
              <line
                x1={VB_W / 2}
                y1="0"
                x2={VB_W / 2}
                y2={VB_H}
                stroke="rgba(248,250,252,0.48)"
                strokeWidth="0.32"
              />
              <circle
                cx={VB_W / 2}
                cy={VB_H / 2}
                r={9.15}
                fill="none"
                stroke="rgba(248,250,252,0.46)"
                strokeWidth="0.32"
              />
              <rect
                x="0"
                y="13.84"
                width="16.5"
                height="40.32"
                fill="none"
                stroke="rgba(248,250,252,0.46)"
                strokeWidth="0.32"
              />
              <rect
                x={VB_W - 16.5}
                y="13.84"
                width="16.5"
                height="40.32"
                fill="none"
                stroke="rgba(248,250,252,0.46)"
                strokeWidth="0.32"
              />
            </g>
          </svg>
        )}
      </div>
      {!heatmap || !showHeatmap ? null : (
        <HeatmapLegend labelA={labelA} labelB={labelB} />
      )}
    </div>
  );
}
