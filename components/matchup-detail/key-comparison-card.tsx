import clsx from "clsx";
import { ComparisonMetric } from "./comparison-metric";
import type { ComparisonMetricModel } from "./types";

interface KeyComparisonCardProps {
  metrics: ComparisonMetricModel[];
  className?: string;
}

export function KeyComparisonCard({ metrics, className }: KeyComparisonCardProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] p-5 shadow-[0_14px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-[rgba(120,170,255,0.22)]",
        className
      )}
    >
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Confronto chiave</h3>
      <div className="mt-4 space-y-3">
        {metrics.map((m) => (
          <ComparisonMetric key={m.id} metric={m} />
        ))}
      </div>
    </section>
  );
}
