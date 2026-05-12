"use client";

import { GenericAvatar } from "./generic-avatar";

export function ProfileHeaderCard({
  displayName,
  email,
  memberSinceLabel,
  organizationName,
  onEditClick
}: {
  displayName: string;
  email: string;
  memberSinceLabel: string;
  organizationName: string;
  onEditClick: () => void;
}) {
  const parts = displayName.split(/\s+/).filter(Boolean);
  const ini =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
      : (displayName.slice(0, 2) || "U").toUpperCase();

  return (
    <section className="rounded-[1.35rem] border border-[rgba(120,170,255,0.12)] bg-[rgba(8,16,32,0.92)] p-6 shadow-[0_0_35px_rgba(139,92,246,0.06)] sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <GenericAvatar initials={ini} size="xl" />
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{displayName}</h2>
            <p className="mt-1 truncate text-sm text-slate-400">{email}</p>
            <p className="mt-2 text-xs text-slate-500">
              Organizzazione: <span className="text-slate-300">{organizationName}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Membro dal {memberSinceLabel}</p>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <button
            type="button"
            onClick={onEditClick}
            className="rounded-xl border border-cyan-400/35 bg-transparent px-6 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/10"
          >
            Modifica profilo
          </button>
        </div>
      </div>
    </section>
  );
}
