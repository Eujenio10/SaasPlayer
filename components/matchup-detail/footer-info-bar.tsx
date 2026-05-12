import clsx from "clsx";
import { Info } from "lucide-react";

interface FooterInfoBarProps {
  disclaimer: string;
  updatedAt: string;
  className?: string;
}

export function FooterInfoBar({ disclaimer, updatedAt, className }: FooterInfoBarProps) {
  return (
    <footer
      className={clsx(
        "mt-6 flex flex-col gap-3 rounded-2xl border border-[rgba(120,170,255,0.12)] bg-[rgba(4,11,20,0.85)] px-4 py-3 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="flex items-start gap-2 sm:max-w-[70%]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#38bdf8]" aria-hidden />
        <span>{disclaimer}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <span className="tabular-nums text-[#94A3B8]">Ultimo aggiornamento: {updatedAt}</span>
        <span className="rounded-full bg-[rgba(16,185,129,0.14)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#10B981]">
          LIVE
        </span>
      </div>
    </footer>
  );
}
