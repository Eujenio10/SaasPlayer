"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ProfileDropdown({
  initials,
  displayNameShort
}: {
  initials: string;
  displayNameShort: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] px-2 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400/35 hover:bg-cyan-500/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-600/25 text-[11px] font-black text-white">
          {initials.slice(0, 2)}
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">{displayNameShort}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[200px] rounded-xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.98)] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/5"
        >
          <Link
            href="/profilo"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 text-cyan-300" />
            Il mio profilo
          </Link>
          <a href="#settings" className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]">
            <Settings className="h-4 w-4 text-slate-400" />
            Impostazioni
          </a>
          <Link
            href="/auth/logout"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-rose-200 hover:bg-rose-500/10"
            role="menuitem"
            prefetch={false}
            onClick={() => setOpen(false)}
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Link>
        </div>
      ) : null}
    </div>
  );
}
