"use client";

import { committedRiskGaugeColors, committedRiskGaugeLabel } from "./presentational";

export function RiskGaugeSemicircle({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  const { arc, label: labelClass } = committedRiskGaugeColors(v);
  const angle = (v / 100) * Math.PI;
  const cx = 50;
  const cy = 52;
  const r = 38;
  const x2 = cx + r * Math.cos(Math.PI - angle);
  const y2 = cy - r * Math.sin(Math.PI - angle);

  return (
    <div className="flex flex-col items-center justify-end">
      <svg viewBox="0 0 100 58" className="h-[100px] w-[200px] max-w-full sm:h-[120px]" aria-hidden>
        <path
          d="M 12 52 A 38 38 0 0 1 88 52"
          fill="none"
          stroke="rgba(120,170,255,0.12)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 12 52 A 38 38 0 0 1 88 52"
          fill="none"
          stroke={arc}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * 120} 120`}
        />
        <line
          x1={cx}
          y1={cy}
          x2={x2}
          y2={y2}
          stroke="rgba(248,250,252,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="rgba(248,250,252,0.95)" />
      </svg>
      <p className="-mt-1 text-2xl font-black tabular-nums text-white sm:text-3xl">
        {v}
        <span className="text-lg font-bold text-slate-500">/100</span>
      </p>
      <p className={`mt-1 text-center text-xs font-bold uppercase tracking-wide ${labelClass}`}>
        {committedRiskGaugeLabel(v)}
      </p>
    </div>
  );
}
