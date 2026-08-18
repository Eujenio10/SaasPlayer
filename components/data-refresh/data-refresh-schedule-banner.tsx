"use client";

import { Clock3 } from "lucide-react";
import type { DataRefreshStatus } from "@/lib/data-refresh/status";
import { useCountdownTo } from "@/lib/data-refresh/use-countdown-to";

export function DataRefreshScheduleBanner({ status }: { status: DataRefreshStatus | null }) {
  const { countdownLabel, msRemaining } = useCountdownTo(status?.nextScheduledAt);

  if (!status) return null;

  const inProgress = Boolean(status.inProgress) || msRemaining === 0;

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/8 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
            <Clock3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-cyan-100">Aggiornamento dati automatico</p>
            <p className="mt-1 text-xs leading-6 text-slate-300">
              Calendario, insight e moduli analitici si aggiornano ogni giorno dalle{" "}
              <span className="font-bold text-slate-100">{status.scheduleLabel}</span> (ora di Roma),
              un campionato dopo l&apos;altro.
            </p>
            {status.inProgress && status.currentCompetitionLabel ? (
              <p className="mt-1 text-xs font-semibold text-cyan-200">
                In corso: {status.currentCompetitionLabel}
              </p>
            ) : null}
            {status.lastRefreshLabel ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Ultimo aggiornamento: {status.lastRefreshLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-cyan-300/15 bg-[#07111F]/80 px-4 py-2 text-center sm:min-w-[180px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Prossimo aggiornamento
          </p>
          <p className="mt-1 text-sm font-black text-cyan-200">
            {inProgress ? "In corso…" : countdownLabel ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
