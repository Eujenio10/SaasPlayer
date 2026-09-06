"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import type { FantaDuelResult, FantaPlayerSearchHit } from "@/lib/fanta/types";

const ROLE_LABEL: Record<string, string> = {
  goalkeeper: "Portiere",
  defender: "Difensore",
  midfielder: "Centrocampista",
  forward: "Attaccante"
};

const ROLE_ERROR = "Seleziona due giocatori dello stesso ruolo per effettuare il confronto.";

type Slot = "a" | "b";

export function FantaLineupPage() {
  const [playerA, setPlayerA] = useState<FantaPlayerSearchHit | null>(null);
  const [playerB, setPlayerB] = useState<FantaPlayerSearchHit | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot>("a");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FantaPlayerSearchHit[]>([]);
  const [result, setResult] = useState<FantaDuelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const pick = (hit: FantaPlayerSearchHit) => {
    setResult(null);
    setError(null);
    if (activeSlot === "a") {
      setPlayerA(hit);
      if (!playerB) setActiveSlot("b");
    } else {
      setPlayerB(hit);
    }
    setQuery("");
    setHits([]);
  };

  const roleError = playerA && playerB && playerA.roleGroup !== playerB.roleGroup ? ROLE_ERROR : null;

  const analyze = async () => {
    if (!playerA || !playerB) return;
    if (playerA.roleGroup !== playerB.roleGroup) {
      setError(ROLE_ERROR);
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fanta/lineup?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}&playerAId=${encodeURIComponent(playerA.playerId)}&playerBId=${encodeURIComponent(playerB.playerId)}`
      );
      const json = (await res.json()) as FantaDuelResult & { error?: string; message?: string };
      if (!res.ok || json.error) {
        setResult(null);
        setError(json.message || ROLE_ERROR);
        return;
      }
      setResult(json);
    } catch {
      setResult(null);
      setError("Impossibile completare il confronto.");
    } finally {
      setLoading(false);
    }
  };

  const slotCard = (slot: Slot, player: FantaPlayerSearchHit | null) => (
    <button
      type="button"
      onClick={() => setActiveSlot(slot)}
      className={`rounded-3xl border p-4 text-left transition ${
        activeSlot === slot ? "border-emerald-300/70 bg-emerald-400/10" : "border-white/10 bg-black/30"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
        {slot === "a" ? "Giocatore A" : "Giocatore B"}
      </p>
      {player ? (
        <>
          <p className="mt-2 font-bold text-white">{player.playerName}</p>
          <p className="text-sm text-slate-400">
            {player.teamName || "n.d."} · {ROLE_LABEL[player.roleGroup] ?? player.roleGroup}
            {player.mantra ? ` · ${player.mantra}` : ""}
          </p>
          <span
            role="button"
            tabIndex={0}
            className="mt-2 inline-block text-xs font-semibold text-emerald-300"
            onClick={(event) => {
              event.stopPropagation();
              setResult(null);
              if (slot === "a") setPlayerA(null);
              else setPlayerB(null);
              setActiveSlot(slot);
            }}
          >
            Cambia
          </span>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          {slot === "a" ? "Cerca giocatore A" : "Cerca giocatore B"}
        </p>
      )}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-black/40 p-6">
        <Link href="/kiosk/fanta" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ← PitchBrain Fanta
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">PITCHBRAIN FANTA DUEL ⚔️</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Confronta due giocatori dello stesso ruolo e ottieni un profilo favorevole per la prossima giornata.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeSlot === "a" ? "Cerca giocatore A" : "Cerca giocatore B"}
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          />
        </div>
        {hits.map((hit) => (
          <button
            key={hit.playerId}
            type="button"
            onClick={() => pick(hit)}
            className="mt-2 block w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-400/10"
          >
            {hit.playerName} · {hit.teamName || "n.d."} · {ROLE_LABEL[hit.roleGroup] ?? hit.roleGroup}
            {hit.mantra ? ` · ${hit.mantra}` : ""}
          </button>
        ))}
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {slotCard("a", playerA)}
        {slotCard("b", playerB)}
      </div>
      {roleError ? <p className="text-sm font-semibold text-rose-300">{roleError}</p> : null}
      <button
        type="button"
        onClick={() => void analyze()}
        disabled={!playerA || !playerB}
        className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-black disabled:opacity-40"
      >
        Confronta
      </button>
      {loading ? <p className="text-slate-400">Analisi in corso…</p> : null}
      {error && !roleError ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}
      {result ? (
        <section className="space-y-5 rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[result.playerA, result.playerB].map((side, index) => (
              <article key={side.playerId} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                  {index === 0 ? "Giocatore A" : "Giocatore B"}
                </p>
                <h2 className="mt-2 text-xl font-bold text-white">{side.playerName}</h2>
                <p className="text-sm text-slate-400">
                  {side.teamName || "n.d."} · {ROLE_LABEL[side.roleGroup] ?? side.roleGroup}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">PitchBrain Fanta Score</p>
                <p className="text-4xl font-black text-emerald-300">{side.fantaScore}</p>
              </article>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Confronto indicatori</h3>
            <ul className="mt-3 space-y-3">
              {result.pillars.map((pillar) => (
                <li key={pillar.id} className="border-t border-white/10 pt-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-white">{pillar.label}</p>
                    <p className="text-sm font-semibold text-emerald-300">
                      {pillar.winner === "a"
                        ? `${result.playerA.playerName} 🟢`
                        : pillar.winner === "b"
                          ? `${result.playerB.playerName} 🟢`
                          : "—"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">A · {pillar.detailA}</p>
                  <p className="text-sm text-slate-400">B · {pillar.detailB}</p>
                  {pillar.edgeLabel ? <p className="text-sm text-slate-200">{pillar.edgeLabel}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-black/40 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
              🏆 {result.recommended === "tie" ? "Profili allineati" : "Giocatore consigliato"}
            </p>
            {result.recommended !== "tie" ? (
              <p className="mt-2 text-xl font-bold text-white">
                {result.recommended === "a" ? result.playerA.playerName : result.playerB.playerName}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.motivation}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
