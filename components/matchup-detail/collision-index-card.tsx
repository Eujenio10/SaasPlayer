import clsx from "clsx";
import { Gauge } from "lucide-react";

interface CollisionIndexCardProps {
  score: number;
  scoreLabel: string;
  description: string;
  className?: string;
}

export function CollisionIndexCard({
  score,
  scoreLabel,
  description,
  className
}: CollisionIndexCardProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] p-5 shadow-[0_14px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-[rgba(120,170,255,0.22)]",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(239,68,68,0.12)] text-[#EF4444]">
          <Gauge className="h-7 w-7" aria-hidden strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Indice scontro</h3>
            <p className="text-3xl font-black tabular-nums tracking-tight text-[#EF4444]">{score}/100</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{description}</p>
          <p className="mt-3 inline-flex rounded-full border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] px-3 py-1 text-xs font-semibold text-[#fecaca]">
            {scoreLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
