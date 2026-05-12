import type { SparkFrictionHeatmapPayload } from "@/lib/types";

type FrictionPitchHeatmapProps = SparkFrictionHeatmapPayload & {
  className?: string;
  /** Rendering compatto (liste / card) senza alterare i punti. */
  compact?: boolean;
  /** Cerchio tratteggiato in coordinate campo 0–100 (solo evidenziazione visiva). */
  highlightCirclePct?: { cx: number; cy: number; r: number };
};

/** Campo orizzontale: lunghezza 105, larghezza 68 (proporzioni da regolamento). */
const VB_W = 105;
const VB_H = 68;

function maxIntensity(points: SparkFrictionHeatmapPayload["pointsA"]): number {
  let m = 1;
  for (const p of points) {
    const w = p.intensity ?? 1;
    if (w > m) m = w;
  }
  return m;
}

/** Coordinate API 0–100 → SVG (porta a sinistra e destra). */
function toSvgXY(x: number, y: number): { sx: number; sy: number } {
  const sx = (Math.max(0, Math.min(100, x)) / 100) * VB_W;
  const sy = (Math.max(0, Math.min(100, y)) / 100) * VB_H;
  return { sx, sy };
}

export function FrictionPitchHeatmap({
  labelA,
  labelB,
  clubColorA,
  clubColorB,
  pointsA,
  pointsB,
  className = "",
  compact = false,
  highlightCirclePct
}: FrictionPitchHeatmapProps) {
  const globalMax = Math.max(maxIntensity(pointsA), maxIntensity(pointsB), 1);

  const renderBlobs = (points: SparkFrictionHeatmapPayload["pointsA"], color: string) =>
    points.map((p, i) => {
      const { sx, sy } = toSvgXY(p.x, p.y);
      const w = p.intensity ?? 1;
      const norm = w / globalMax;
      /* Raggi contenuti: sul campo ingrandito i punti restano leggibili e meno ammassati. */
      const r = 1.65 + norm * 3.8;
      const opacity = 0.22 + norm * 0.45;
      return (
        <g key={`${color}-${i}-${sx.toFixed(2)}-${sy.toFixed(2)}`}>
          <circle cx={sx} cy={sy} r={r * 1.28} fill={color} opacity={opacity * 0.32} />
          <circle cx={sx} cy={sy} r={r} fill={color} opacity={opacity} />
        </g>
      );
    });

  const empty = pointsA.length === 0 && pointsB.length === 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative w-full overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-2 shadow-[0_18px_50px_rgba(8,13,28,0.35)] ring-1 ring-white/10">
        {/* Campo largo: priorità alla larghezza così i punti si distribuiscono meglio sullo schermo. */}
        <div
          className="relative mx-auto w-full max-w-[min(100%,1200px)]"
          style={{
            aspectRatio: `${VB_W} / ${VB_H}`,
            minHeight: compact ? "88px" : "min(280px, 85vw)",
            maxHeight: compact ? "120px" : "min(78vh, 720px)"
          }}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="block h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Mappa delle posizioni sul campo tra ${labelA} e ${labelB}`}
          >
          <title>Mappa posizioni: {labelA} e {labelB}</title>
          <defs>
            <linearGradient id="turfFriction" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2f8f55" />
              <stop offset="45%" stopColor="#227644" />
              <stop offset="100%" stopColor="#155433" />
            </linearGradient>
            <linearGradient id="turfStripe" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.07)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </linearGradient>
            <clipPath id="pitchClipFriction">
              <rect x="0.5" y="0.5" width={VB_W - 1} height={VB_H - 1} rx="1.8" ry="1.8" />
            </clipPath>
          </defs>

          <g clipPath="url(#pitchClipFriction)">
            <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#turfFriction)" />
            {Array.from({ length: 9 }).map((_, i) => (
              <rect
                key={`stripe-${i}`}
                x="0"
                y={(i * VB_H) / 9}
                width={VB_W}
                height={VB_H / 9}
                fill="url(#turfStripe)"
                opacity={i % 2 === 0 ? 1 : 0}
              />
            ))}
            <rect
              x="0.35"
              y="0.35"
              width={VB_W - 0.7}
              height={VB_H - 0.7}
              rx="1.6"
              ry="1.6"
              fill="none"
              stroke="rgba(255,255,255,0.62)"
              strokeWidth="0.4"
            />
            <line
              x1={VB_W / 2}
              y1="0"
              x2={VB_W / 2}
              y2={VB_H}
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="0.35"
            />
            <circle
              cx={VB_W / 2}
              cy={VB_H / 2}
              r={9.15}
              fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="0.35"
            />
            <rect
              x="0"
              y="13.84"
              width="16.5"
              height="40.32"
              fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="0.35"
            />
            <rect
              x={VB_W - 16.5}
              y="13.84"
              width="16.5"
              height="40.32"
              fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="0.35"
            />
            <g style={{ mixBlendMode: "screen" }}>{renderBlobs(pointsB, clubColorB)}</g>
            <g style={{ mixBlendMode: "screen" }}>{renderBlobs(pointsA, clubColorA)}</g>
            {highlightCirclePct ? (
              <circle
                cx={(Math.max(0, Math.min(100, highlightCirclePct.cx)) / 100) * VB_W}
                cy={(Math.max(0, Math.min(100, highlightCirclePct.cy)) / 100) * VB_H}
                r={Math.max(2, (Math.max(0, Math.min(100, highlightCirclePct.r)) / 100) * VB_H)}
                fill="none"
                stroke="rgba(248,250,252,0.55)"
                strokeWidth="0.55"
                strokeDasharray="1.8 2.2"
              />
            ) : null}
          </g>

          {empty ? (
            <text
              x={VB_W / 2}
              y={VB_H / 2}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize="3.4"
              className="select-none"
            >
              Mappa non disponibile
            </text>
          ) : null}
        </svg>
        </div>
      </div>
      {!compact ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="mb-3 text-sm font-bold text-white">Legenda facile</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-base text-slate-200">
            <span className="inline-flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full shadow-md ring-2 ring-white/20"
                style={{ backgroundColor: clubColorA }}
              />
              <span className="font-medium text-slate-100">{labelA}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full shadow-md ring-2 ring-white/20"
                style={{ backgroundColor: clubColorB }}
              />
              <span className="font-medium text-slate-100">{labelB}</span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Se i colori sono vicini o sovrapposti, i due giocatori possono incontrarsi spesso. Il colore più intenso indica
            una zona in cui il giocatore passa più tempo.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clubColorA }} />
            <span className="truncate">{labelA}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: clubColorB }} />
            <span className="truncate">{labelB}</span>
          </span>
        </p>
      )}
    </div>
  );
}
