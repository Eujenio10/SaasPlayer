"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Sword,
  TriangleAlert,
  UserRound
} from "lucide-react";

const cardCls =
  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] text-slate-200 hover:border-cyan-400/35 hover:bg-cyan-500/10 hover:text-white";
const activeCls =
  "pointer-events-none border-cyan-400/55 bg-gradient-to-r from-cyan-500/20 to-blue-600/15 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)]";

export function RiskCommittedSidebar({
  onOpenSuffered,
  kioskHref
}: {
  onOpenSuffered: () => void;
  /** Path corrente del kiosk (/kiosk o /kiosk/hybrid). */
  kioskHref: string;
}) {
  const frictionHref = `${kioskHref}?analytics=friction`;

  return (
    <aside className="hidden shrink-0 flex-col lg:flex lg:w-[240px]">
      <div className="sticky top-4 space-y-1 rounded-[1.35rem] border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] p-3">
        <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Navigazione</p>
        <Link href="/" prefetch={false} className={`${cardCls}`}>
          <LayoutDashboard className="h-4 w-4 text-cyan-300" />
          Dashboard
        </Link>
        <Link href={frictionHref} prefetch={false} className={`${cardCls}`}>
          <Sword className="h-4 w-4 text-cyan-300" />
          Scontri in campo
        </Link>
        <div className={`${cardCls} ${activeCls}`}>
          <Shield className="h-4 w-4 text-cyan-300" />
          Rischio falli commessi
        </div>
        <button type="button" className={`${cardCls}`} onClick={() => void onOpenSuffered()}>
          <BarChart3 className="h-4 w-4 text-cyan-300" />
          Rischio falli subiti
        </button>
        <Link href="/kiosk/allarme-ammonizioni" prefetch={false} className={cardCls}>
          <TriangleAlert className="h-4 w-4 text-amber-300" />
          Allarme ammonizioni
        </Link>
        <Link href={`${kioskHref}#kiosk-fixture-picker`} prefetch={false} className={`${cardCls}`}>
          <CalendarDays className="h-4 w-4 text-cyan-300" />
          Partite in programma
        </Link>
        <div className="my-3 border-t border-white/10" />
        <a href="#settings" className={cardCls}>
          <Settings className="h-4 w-4 text-slate-400" />
          Impostazioni
        </a>
        <a href="#profilo" className={cardCls}>
          <UserRound className="h-4 w-4 text-slate-400" />
          Il mio profilo
        </a>
        <Link href="/auth/logout" prefetch={false} className={`${cardCls} text-rose-200 hover:border-rose-400/50`}>
          <LogOut className="h-4 w-4" />
          Esci
        </Link>
      </div>
    </aside>
  );
}
