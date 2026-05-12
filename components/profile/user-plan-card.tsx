"use client";

import type { UserAccessRole } from "@/lib/auth/organization";
import { planLabelIt, profileFeaturesForRole, type ProfileFeatureItem } from "@/lib/profile-features";
import { FeatureAccessGrid } from "./feature-access-grid";
import { StatusBadge } from "./status-badge";

function planTone(role: UserAccessRole): string {
  if (role === "admin") return "border-amber-400/45 bg-amber-500/15 text-amber-100 ring-amber-400/25";
  if (role === "pro") return "border-violet-400/45 bg-violet-500/15 text-violet-100 ring-violet-400/25";
  return "border-sky-400/45 bg-sky-500/12 text-sky-100 ring-sky-400/25";
}

export function UserPlanCard({ role, features }: { role: UserAccessRole; features?: ProfileFeatureItem[] }) {
  const list = features ?? profileFeaturesForRole(role);
  const label = planLabelIt(role);

  return (
    <section className="rounded-[1.35rem] border border-[rgba(120,170,255,0.12)] bg-[rgba(8,16,32,0.92)] p-6 shadow-[0_0_40px_rgba(59,130,246,0.06)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">Piano utente</h2>
          <p className="mt-1 text-sm text-slate-500">Ruolo assegnato dall&apos;amministratore della piattaforma.</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ${planTone(role)}`}
        >
          {label}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-400">
          Piano attuale: <strong className="text-slate-200">{label}</strong>
        </p>
        <StatusBadge>Attivo</StatusBadge>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
        Il piano resta attivo finché non viene modificato da un amministratore.
      </p>

      <FeatureAccessGrid items={list} />
    </section>
  );
}
