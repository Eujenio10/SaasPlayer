"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import type { FantaTrendCategory, FantaTrendRow } from "@/lib/fanta/types";

const CATS: Array<{ id: FantaTrendCategory; label: string }> = [
  { id: "rising", label: "In crescita" },
  { id: "falling", label: "In calo" },
  { id: "best5", label: "Migliori ultime 5" },
  { id: "best10", label: "Migliori ultime 10" }
];

export function FantaTrendsPage() {
  const [category, setCategory] = useState<FantaTrendCategory>("rising");
  const [rows, setRows] = useState<FantaTrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/fanta/trends?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}&category=${category}`)
      .then((res) => res.json())
      .then((json) => setRows(Array.isArray(json.rows) ? json.rows : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-black/40 p-6">
        <Link href="/kiosk/fanta" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ← PitchBrain Fanta
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">Trend giocatori</h1>
        <p className="mt-2 text-sm text-slate-400">
          Serie A · stagione in corso · crescita e calo sulle ultime 3 partite.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {CATS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                category === item.id
                  ? "border-emerald-300 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 text-slate-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {loading ? <p className="text-slate-400">Analisi in corso…</p> : null}
      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.playerId} className="rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{row.playerName}</h2>
                <p className="text-sm text-slate-400">{row.teamName || "—"}</p>
              </div>
              <p className="text-sm font-bold text-emerald-200">
                {row.trend === "up" ? "📈 Crescita" : row.trend === "down" ? "📉 Calo" : "➡ Stabilità"}
              </p>
            </div>
            <p className="mt-3 font-mono text-sm text-emerald-100">
              {row.ratings.map((n) => n.toFixed(1)).join("  ")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
