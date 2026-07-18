"use client";

import {
  PLAYER_PERFORMANCE_TEXT,
  sparklineAriaLabel,
  sparklineText
} from "@/lib/player-performance/text";

export function PlayerPerformanceSparkline({
  metric,
  values,
  className = ""
}: {
  metric: "shots" | "shotsOnTarget" | "keyPasses" | "rating";
  values: number[];
  className?: string;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 0.1);
  const barMaxPx = 28;

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {metric === "shots"
          ? PLAYER_PERFORMANCE_TEXT.sparklineShots
          : metric === "shotsOnTarget"
            ? PLAYER_PERFORMANCE_TEXT.sparklineShotsOnTarget
            : metric === "keyPasses"
              ? PLAYER_PERFORMANCE_TEXT.sparklineKeyPasses
              : PLAYER_PERFORMANCE_TEXT.sparklineRating}
      </p>
      <div
        className="mt-1 flex h-10 items-end gap-1 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5"
        role="img"
        aria-label={sparklineAriaLabel(metric, values)}
      >
        {values.map((value, index) => {
          const heightPx = Math.max(4, Math.round((value / max) * barMaxPx));
          return (
            <div key={`${index}-${value}`} className="flex flex-1 items-end justify-center">
              <div
                className="w-full max-w-[14px] rounded-t bg-gradient-to-t from-cyan-600/80 to-cyan-300/90"
                style={{ height: heightPx }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-1 font-mono text-[11px] text-slate-400" aria-hidden>
        {sparklineText(values)}
      </p>
    </div>
  );
}
