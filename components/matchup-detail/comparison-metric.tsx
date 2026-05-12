import clsx from "clsx";
import type { ComparisonMetricModel } from "./types";
import { MATCHUP_COLORS } from "./matchup-mapping";

interface ComparisonMetricProps {
  metric: ComparisonMetricModel;
}

function formatVal(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function ComparisonMetric({ metric }: ComparisonMetricProps) {
  const t = metric.valueLeft + metric.valueRight || 1;
  const leftShare = metric.valueLeft / t;
  const rightShare = metric.valueRight / t;

  return (
    <div className="rounded-xl border border-[rgba(120,170,255,0.1)] bg-black/20 px-3 py-3">
      <div className="flex items-end justify-between gap-2 text-sm font-semibold text-[#F8FAFC]">
        <span className="tabular-nums" style={{ color: MATCHUP_COLORS.blue }}>
          {formatVal(metric.valueLeft)}
          {metric.showYellowCards ? (
            <span
              className="ml-1 inline-block h-4 w-2.5 align-middle rounded-[2px] bg-[#FACC15]"
              title="Gialli"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="flex-1 px-2 text-center text-[11px] font-semibold uppercase leading-snug tracking-wide text-[#94A3B8]">
          {metric.label}
        </span>
        <span className="tabular-nums text-right" style={{ color: MATCHUP_COLORS.red }}>
          {formatVal(metric.valueRight)}
          {metric.showYellowCards ? (
            <span
              className="ml-1 inline-block h-4 w-2.5 align-middle rounded-[2px] bg-[#FACC15]"
              title="Gialli"
              aria-hidden
            />
          ) : null}
        </span>
      </div>
      <div className={clsx("mt-3 flex h-2 overflow-hidden rounded-full bg-black/35")}>
        <div
          className="h-full rounded-l-full transition-[width] duration-300"
          style={{ width: `${leftShare * 100}%`, backgroundColor: MATCHUP_COLORS.blue }}
        />
        <div
          className="h-full rounded-r-full transition-[width] duration-300"
          style={{ width: `${rightShare * 100}%`, backgroundColor: MATCHUP_COLORS.red }}
        />
      </div>
    </div>
  );
}
