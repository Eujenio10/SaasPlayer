"use client";

import Link from "next/link";

const LINKS = [
  {
    href: "/kiosk/fanta/scout",
    title: "Fanta Scout",
    body: "PitchBrain Fanta Rating, ultime prestazioni e trend sul rating FootAPI."
  },
  {
    href: "/kiosk/fanta/lineup",
    title: "PITCHBRAIN FANTA DUEL ⚔️",
    body: "Confronta due giocatori dello stesso ruolo e scopri quale profilo è più favorevole."
  },
  {
    href: "/kiosk/fanta/matchup",
    title: "PITCHBRAIN FANTA MATCHUP",
    body: "Report della giornata: solo giocatori di valore, favorevoli o penalizzati dal matchup."
  },
  {
    href: "/kiosk/fanta/trends",
    title: "Trend giocatori",
    body: "Crescita e calo sulle ultime 3 partite della stagione in corso in Serie A."
  },
  {
    href: "/kiosk/fanta/ranking",
    title: "Ranking Fanta",
    body: "Classifiche per ruolo ordinate sul PitchBrain Fanta Rating."
  }
] as const;

export function FantaHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-black to-cyan-400/10 p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
          PitchBrain Fanta
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">PITCHBRAIN FANTA</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Strumento di analisi avanzata per il fantallenatore di Serie A. Indice proprietario sui dati di campo:
          rating prestazioni, produzione, continuità e matchup individuali. Nessun voto ufficiale, nessun
          pronostico economico.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-3xl border border-emerald-400/20 bg-black/40 p-5 transition hover:border-emerald-300/50 hover:bg-emerald-400/5"
          >
            <h2 className="text-lg font-bold text-emerald-200">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
