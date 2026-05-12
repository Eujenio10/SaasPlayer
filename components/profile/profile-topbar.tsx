"use client";

import { ProfileDropdown } from "./profile-dropdown";

export function ProfileTopbar({
  displayName,
  initials,
  email
}: {
  displayName: string;
  initials: string;
  email: string;
}) {
  const short = displayName || email.split("@")[0] || "Utente";

  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-[rgba(120,170,255,0.12)] pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-tight text-white sm:text-xl">
            IL <span className="text-cyan-300">DODICESIMO</span>
          </span>
        </div>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
          Accesso attivo
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProfileDropdown initials={initials} displayNameShort={short} />
      </div>
    </header>
  );
}
