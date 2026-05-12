import clsx from "clsx";
import type { MatchupReasonModel } from "./types";
import { WhyReasonBox } from "./why-reason-box";

interface WhyInterestingCardProps {
  reasons: MatchupReasonModel[];
  className?: string;
}

export function WhyInterestingCard({ reasons, className }: WhyInterestingCardProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] p-5 shadow-[0_14px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-[rgba(120,170,255,0.22)]",
        className
      )}
    >
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Perché è uno scontro interessante</h3>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-stretch">
        {reasons.map((r) => (
          <div key={r.id} className="min-w-0 flex-1">
            <WhyReasonBox reason={r} />
          </div>
        ))}
      </div>
    </section>
  );
}
