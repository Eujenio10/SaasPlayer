import clsx from "clsx";
import { Activity, Shield, TriangleAlert } from "lucide-react";
import type { MatchupReasonModel } from "./types";

interface WhyReasonBoxProps {
  reason: MatchupReasonModel;
}

function iconFor(id: string) {
  if (id === "duel")
    return <Shield className="h-5 w-5 text-[#EF4444]" strokeWidth={2} aria-hidden />;
  if (id === "foul_diff")
    return <Activity className="h-5 w-5 text-[#FACC15]" strokeWidth={2} aria-hidden />;
  return <TriangleAlert className="h-5 w-5 text-[#8B5CF6]" strokeWidth={2} aria-hidden />;
}

export function WhyReasonBox({ reason }: WhyReasonBoxProps) {
  return (
    <div
      className={clsx(
        "flex gap-3 rounded-xl border border-[rgba(120,170,255,0.12)] bg-[rgba(8,16,32,0.55)] p-4",
        "transition hover:border-[rgba(120,170,255,0.22)]"
      )}
    >
      <div className="mt-0.5 shrink-0 rounded-lg bg-black/25 p-2">{iconFor(reason.id)}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#F8FAFC]">{reason.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{reason.description}</p>
      </div>
    </div>
  );
}
