"use client";

import { useState } from "react";
import clsx from "clsx";
import { Crown, Menu, X } from "lucide-react";

interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className={clsx(
          "flex items-center justify-between gap-4 rounded-2xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl p-2 text-[#94A3B8] transition hover:bg-white/5 hover:text-[#F8FAFC]"
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[0.12em] text-[#F8FAFC] md:text-base">
              IL DODICESIMO
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-amber-400/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.2)] sm:inline-flex"
            title="Abbonamento attivo"
          >
            <Crown className="h-3.5 w-3.5 text-amber-300" />
            Abbonamento attivo
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(120,170,255,0.25)] bg-gradient-to-br from-[#0f172a] to-[#040B14] text-xs font-bold text-[#F8FAFC]"
            aria-label="Profilo utente"
          >
            ID
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[100]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(280px,88vw)] flex-col gap-6 border-r border-[rgba(120,170,255,0.15)] bg-[#040B14] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#F8FAFC]">Navigazione</span>
              <button
                type="button"
                className="rounded-lg p-1 text-[#94A3B8] hover:bg-white/5"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 text-sm text-[#94A3B8]">
              <span className="rounded-lg px-3 py-2 text-[#F8FAFC]">Scontri in campo</span>
              <span className="rounded-lg px-3 py-2 opacity-60">Analisi tattiche</span>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
