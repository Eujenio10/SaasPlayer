"use client";

import { Info } from "lucide-react";

export function CommittedRiskInfoBox() {
  return (
    <aside
      className="rounded-2xl border border-[rgba(120,170,255,0.18)] bg-[rgba(8,16,32,0.92)] p-4 shadow-[0_12px_40px_rgba(2,12,34,0.35)] lg:max-w-sm"
      aria-labelledby="committed-how-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/35">
          <Info className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 id="committed-how-title" className="text-sm font-black uppercase tracking-wide text-cyan-100">
            Come funziona
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Più alti sono i falli subiti dagli avversari che incrocerai, maggiore sarà il rischio di commettere fallo.
          </p>
        </div>
      </div>
    </aside>
  );
}
