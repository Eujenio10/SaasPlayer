"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import type { FantaRankingRow, FantaRoleGroup } from "@/lib/fanta/types";

const ROLES: Array<FantaRoleGroup | "all"> = ["forward", "midfielder", "defender", "goalkeeper", "all"];

const ROLE_LABEL: Record<FantaRoleGroup | "all", string> = {
  all: "Tutti",
  goalkeeper: "Portieri",
  defender: "Difensori",
  midfielder: "Centrocampisti",
  forward: "Attaccanti"
};

export function FantaRankingPage() {
  const [role, setRole] = useState<FantaRoleGroup | "all">("forward");
  const [rows, setRows] = useState<FantaRankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/fanta/ranking?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}&role=${role}`)
      .then((res) => res.json())
      .then((json) => setRows(Array.isArray(json.rows) ? json.rows : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [role]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-black/40 p-6">
        <Link href="/kiosk/fanta" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ← PitchBrain Fanta
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">Ranking Fanta</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          {ROLES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                role === item
                  ? "border-emerald-300 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 text-slate-400"
              }`}
            >
              {ROLE_LABEL[item]}
            </button>
          ))}
        </div>
      </header>
      {loading ? <p className="text-slate-400">Analisi in corso…</p> : null}
      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th>Giocatore</th>
              <th>Squadra</th>
              <th>Rating</th>
              <th>Forma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="border-t border-white/10">
                <td className="px-4 py-3 font-bold text-emerald-300">{row.rank}</td>
                <td className="font-semibold text-white">{row.playerName}</td>
                <td>{row.teamName || "—"}</td>
                <td className="font-bold text-emerald-200">{row.rating}</td>
                <td>{row.form === "up" ? "📈" : row.form === "down" ? "📉" : "➡"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
