import type { SparkFrictionHeatmapPayload } from "@/lib/types";

type FrictionPitchHeatmapProps = SparkFrictionHeatmapPayload & {
  className?: string;
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
  className = ""
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
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
        {/* Campo largo: priorità alla larghezza così i punti si distribuiscono meglio sullo schermo. */}
        <div
          className="relative mx-auto w-full max-w-[min(100%,1200px)]"
          style={{
            aspectRatio: `${VB_W} / ${VB_H}`,
            minHeight: "min(280px, 85vw)",
            maxHeight: "min(78vh, 720px)"
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
              <stop offset="0%" stopColor="#1a6b3c" />
              <stop offset="45%" stopColor="#145a32" />
              <stop offset="100%" stopColor="#0c3d22" />
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
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.4"
            />
            <line
              x1={VB_W / 2}
              y1="0"
              x2={VB_W / 2}
              y2={VB_H}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.35"
            />
            <circle
              cx={VB_W / 2}
              cy={VB_H / 2}
              r={9.15}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.35"
            />
            <rect
              x="0"
              y="13.84"
              width="16.5"
              height="40.32"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.35"
            />
            <rect
              x={VB_W - 16.5}
              y="13.84"
              width="16.5"
              height="40.32"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.35"
            />
            <g style={{ mixBlendMode: "screen" }}>{renderBlobs(pointsB, clubColorB)}</g>
            <g style={{ mixBlendMode: "screen" }}>{renderBlobs(pointsA, clubColorA)}</g>
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full shadow-md ring-2 ring-white/20"
            style={{ backgroundColor: clubColorA }}
          />
          <span className="font-medium text-slate-100">{labelA}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full shadow-md ring-2 ring-white/20"
            style={{ backgroundColor: clubColorB }}
          />
          <span className="font-medium text-slate-100">{labelB}</span>
        </span>
        <span className="text-xs text-slate-500">Più il colore è intenso, più il giocatore è stato spesso in quella zona (stagione).</span>
      </div>
    </div>
  );
}
