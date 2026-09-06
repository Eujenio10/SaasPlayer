"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import type { FantaPlayerSearchHit, FantaScoutPlayer } from "@/lib/fanta/types";
import { fantaRoleLabelIt } from "@/lib/fanta/roles";

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toFixed(1);
}

export function FantaScoutPage() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FantaPlayerSearchHit[]>([]);
  const [player, setPlayer] = useState<FantaScoutPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetch(`/api/fanta/search?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}&q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((json) => setHits(Array.isArray(json.results) ? json.results : []))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const openPlayer = useCallback(async (playerId: string) => {
    setError(null);
    const res = await fetch(
      `/api/fanta/scout?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}&playerId=${encodeURIComponent(playerId)}`
    );
      const json = (await res.json()) as { player?: FantaScoutPlayer };
      if (!res.ok || !json.player) {
        setError("Giocatore non trovato nelle statistiche disponibili.");
        setPlayer(null);
        return;
      }
      setPlayer(json.player);
      setHits([]);
      setQuery(json.player.playerName);
    },
    []
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-black/40 p-6">
        <Link href="/kiosk/fanta" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ← PitchBrain Fanta
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">Fanta Scout</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un giocatore o una squadra"
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          />
        </div>
        {hits.length ? (
          <ul className="mt-3 space-y-1">
            {hits.map((hit) => (
              <li key={hit.playerId}>
                <button
                  type="button"
                  onClick={() => void openPlayer(hit.playerId)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-400/10"
                >
                  {hit.playerName} · {hit.teamName || "n.d."}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      {error ? <p className="text-rose-200">{error}</p> : null}
      {player ? (
        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-black p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{player.teamName}</p>
            <h2 className="mt-1 text-3xl font-bold text-white">{player.playerName}</h2>
            <p className="text-sm text-slate-400">
              {fantaRoleLabelIt(player.roleGroup)}
              {player.mantra ? ` · ${player.mantra}` : ""}
            </p>
            <p className="mt-4 text-5xl font-black text-emerald-300">
              {player.scores.pitchbrainFantaRating}
              <span className="text-lg text-slate-400">/100</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">PitchBrain Fanta Rating</p>
            <p className="mt-3 text-sm text-white">
              {player.trend === "up" ? "📈 Crescita" : player.trend === "down" ? "📉 Calo" : "➡ Stabilità"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Ultima", fmt(player.lastRating)],
              ["Media 5", fmt(player.avgRating5)],
              ["Media 10", fmt(player.avgRating10)],
              ["Delta", player.ratingDelta == null ? "—" : String(player.ratingDelta)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-bold text-emerald-200">{value}</p>
              </div>
            ))}
          </div>
          {player.matchup ? (
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Matchup Fanta</h3>
              <p className="mt-2 text-white">
                vs {player.matchup.nextOpponentName ?? "n.d."} · {player.matchup.roleLabel}
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-200">
                {player.matchup.tone === "favorable"
                  ? "🟢 Favorevole"
                  : player.matchup.tone === "difficult"
                    ? "🔴 Difficile"
                    : "🟡 Neutro"}
              </p>
              <p className="mt-2 text-sm text-slate-300">{player.matchup.headline}</p>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Motivazioni</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-200">
              {player.reasons.map((reason) => (
                <li key={reason.code + reason.text}>· {reason.text}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Ultime 5 prestazioni</h3>
            <table className="mt-3 w-full text-left text-sm text-slate-200">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Partita</th>
                  <th>Rating</th>
                  <th>Min</th>
                  <th>Gol</th>
                  <th>Assist</th>
                </tr>
              </thead>
              <tbody>
                {player.lastFive.map((row) => (
                  <tr key={row.fixtureId} className="border-t border-white/10">
                    <td className="py-2">{row.opponentName || "n.d."}</td>
                    <td>{fmt(row.ratingApi)}</td>
                    <td>{row.minutes}</td>
                    <td>{row.goals ?? 0}</td>
                    <td>{row.assists ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
