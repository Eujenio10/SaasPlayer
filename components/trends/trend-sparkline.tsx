"use client";

import type { PlayerTrend } from "@/lib/trends/types";
import { metricUnitIt } from "@/lib/trends/text";

export function TrendSparkline(props: {
  values: number[];
  baselinePer90: number;
  minutes?: number[];
  className?: string;
}) {
  const max = Math.max(...props.values, props.baselinePer90, 0.1);
  const bars = props.values.map((value, index) => {
    const per90 =
      props.minutes && props.minutes[index] > 0
        ? (value / props.minutes[index]) * 90
        : value;
    const height = Math.max(8, Math.round((per90 / max) * 100));
    return (
      <div key={`${index}-${value}`} className="flex flex-1 flex-col items-center justify-end gap-1">
        <div
          className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-amber-500/80 to-yellow-300/90"
          style={{ height: `${height}%`, minHeight: 8 }}
          title={`${per90.toFixed(1)} ${metricUnitIt("shots")}`}
        />
      </div>
    );
  });

  const baselinePct = Math.max(8, Math.round((props.baselinePer90 / max) * 100));

  return (
    <div className={props.className}>
      <div className="flex h-16 items-end gap-1 rounded-xl border border-white/10 bg-black/20 px-2 py-2">
        {bars}
      </div>
      <div className="relative mt-2 h-px bg-white/10">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-cyan-300/70"
          style={{ bottom: baselinePct }}
        />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Baseline</p>
    </div>
  );
}

export function TrendDeltaBadge(props: { absolute: number; relative: number; metric: PlayerTrend["metric"] }) {
  const pct = Math.round(props.relative * 100);
  return (
    <div className="flex items-end gap-3">
      <span className="text-2xl font-bold text-amber-200">
        +{props.absolute.toFixed(1)}
      </span>
      <span className="pb-1 text-sm font-semibold text-orange-300">+{pct}%</span>
    </div>
  );
}
