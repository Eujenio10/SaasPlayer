"use client";

import { AuthLocaleToggle, useAuthWebLocale } from "@/components/account/auth-web-locale";

export function AccountWelcomeClient() {
  const { locale, setLocale, copy } = useAuthWebLocale();

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <AuthLocaleToggle locale={locale} onChange={setLocale} />
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">PitchBrain</p>
        <h1 className="mt-2 text-3xl font-bold text-cyan-300">{copy.welcomeTitle}</h1>
        <p className="mt-3 text-slate-300">{copy.welcomeBody}</p>
        <p className="mt-4 text-sm text-slate-400">{copy.welcomeClose}</p>
      </div>
    </section>
  );
}
