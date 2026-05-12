"use client";

interface FooterInfoBarProps {
  /** Timestamp leggibile locale (dato reale dai metric). */
  lastUpdatedDisplay: string;
}

export function CommittedRiskFooterBar({ lastUpdatedDisplay }: FooterInfoBarProps) {
  return (
    <footer className="mt-8 flex flex-col gap-3 rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.72)] px-4 py-3 text-xs text-slate-400 shadow-inner sm:flex-row sm:items-center sm:justify-between sm:text-sm">
      <p className="flex items-start gap-2 leading-relaxed">
        <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/80" aria-hidden />
        I dati mostrati sono medie di stagione aggiornate. Le posizioni sono basate su heatmap e statistiche avanzate.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-slate-300">
        <span>
          Ultimo aggiornamento: <strong className="tabular-nums text-slate-100">{lastUpdatedDisplay}</strong>
        </span>
        <span className="rounded-full bg-emerald-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/35">
          LIVE
        </span>
      </div>
    </footer>
  );
}
