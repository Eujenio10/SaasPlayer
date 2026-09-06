"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import { emptyMatchupBriefing } from "@/lib/fanta/matchup-briefing";
import type { FantaMatchupBriefing, FantaMatchupCard, FantaMatchupLane } from "@/lib/fanta/types";

type RoleKey = keyof FantaMatchupBriefing;
type BucketFilter = "all" | "favorevole" | "sfavorevole";

const ROLE_TABS: Array<{ key: RoleKey; label: string }> = [
  { key: "goalkeeper", label: "Portieri" },
  { key: "centralDefender", label: "Centrali" },
  { key: "fullback", label: "Terzini" },
  { key: "midfielder", label: "Centrocampisti" },
  { key: "forward", label: "Attaccanti" }
];

function factorList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function ratingLabel(row: FantaMatchupCard): string {
  return row.avgRating5 != null ? row.avgRating5.toFixed(1) : "n.d.";
}

function laneCount(lane: FantaMatchupLane): number {
  return lane.favorevoli.length + lane.sfavorevoli.length;
}

function firstPopulatedRole(briefing: FantaMatchupBriefing): RoleKey {
  return ROLE_TABS.find((tab) => laneCount(briefing[tab.key]) > 0)?.key ?? "forward";
}

function MatchupPlayerCard({
  row,
  selected,
  onSelect
}: {
  row: FantaMatchupCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const favorable = row.bucket === "favorevole";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-5 text-left transition ${
        selected
          ? "border-emerald-300/50 bg-emerald-400/10"
          : favorable
            ? "border-emerald-400/20 bg-black/30 hover:border-emerald-300/40"
            : "border-rose-400/20 bg-black/30 hover:border-rose-300/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-white">{row.playerName}</p>
          <p className="text-sm text-slate-400">
            {row.teamName}
            {row.mantra ? ` · ${row.mantra}` : ""}
          </p>
        </div>
        <p className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white">{row.dailyScore}</p>
      </div>
      <p className="mt-3 text-sm text-slate-200">
        Rating medio: <span className="font-semibold text-white">{ratingLabel(row)}</span>
      </p>
      <p className="mt-1 text-sm text-slate-300">
        Matchup: vs {row.nextOpponentName ?? "n.d."}
        {row.defenderLane === "fullback" && row.markingOpponentName ? ` · Contro ${row.markingOpponentName}` : ""}
      </p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Perché</p>
      <div className="mt-2 space-y-1 text-sm">
        {factorList(row.positiveFactors).slice(0, 4).map((item) => (
          <p key={item} className="text-emerald-200">
            ✓ {item}
          </p>
        ))}
        {factorList(row.negativeFactors).length ? <p className="pt-1 text-xs uppercase tracking-[0.16em] text-slate-500">ma</p> : null}
        {factorList(row.negativeFactors).slice(0, 4).map((item) => (
          <p key={item} className="text-rose-200">
            ✗ {item}
          </p>
        ))}
      </div>
    </button>
  );
}

export function FantaMatchupPage() {
  const [briefing, setBriefing] = useState<FantaMatchupBriefing>(emptyMatchupBriefing());
  const [role, setRole] = useState<RoleKey>("forward");
  const [bucket, setBucket] = useState<BucketFilter>("all");
  const [open, setOpen] = useState<FantaMatchupCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/fanta/matchups?competitionId=${encodeURIComponent(FANTA_COMPETITION_ID)}`)
      .then((res) => res.json())
      .then((json) => {
        const next = json.briefing && typeof json.briefing === "object" ? json.briefing : emptyMatchupBriefing();
        setBriefing(next);
        setRole(firstPopulatedRole(next));
        setBucket("all");
        setOpen(null);
      })
      .catch(() => {
        setBriefing(emptyMatchupBriefing());
        setOpen(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const lane = briefing[role];
  const roleLabel = ROLE_TABS.find((tab) => tab.key === role)?.label ?? "Attaccanti";
  const showFavorevoli = bucket !== "sfavorevole";
  const showSfavorevoli = bucket !== "favorevole";
  const visibleCount = useMemo(() => {
    const fav = showFavorevoli ? lane.favorevoli.length : 0;
    const hard = showSfavorevoli ? lane.sfavorevoli.length : 0;
    return fav + hard;
  }, [lane, showFavorevoli, showSfavorevoli]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-emerald-400/20 bg-black/40 p-6">
        <Link href="/kiosk/fanta" className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ← PitchBrain Fanta
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-white">PITCHBRAIN FANTA MATCHUP</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Scegli un ruolo: vedi i profili forti in contesto favorevole, e quelli penalizzati dal matchup.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setRole(tab.key);
                setBucket("all");
                setOpen(null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                role === tab.key ? "bg-emerald-400 text-black" : "border border-white/15 text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all", "Tutti"],
              ["favorevole", "🟢 Favorevoli"],
              ["sfavorevole", "🔴 Sfavorevoli"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setBucket(value);
                setOpen(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                bucket === value ? "bg-white/15 text-white" : "border border-white/10 text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {loading ? <p className="text-slate-400">Analisi in corso…</p> : null}
      {!loading ? (
        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-white">{roleLabel}</h2>
          {showFavorevoli ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">🟢 Favorevoli</h3>
              {lane.favorevoli.length ? (
                <div className="grid gap-3">
                  {lane.favorevoli.map((row) => (
                    <MatchupPlayerCard
                      key={row.matchupId}
                      row={row}
                      selected={open?.matchupId === row.matchupId}
                      onSelect={() => setOpen(row)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nessun profilo favorevole in evidenza per questo ruolo.</p>
              )}
            </section>
          ) : null}
          {showSfavorevoli ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-300">🔴 Sfavorevoli</h3>
              {lane.sfavorevoli.length ? (
                <div className="grid gap-3">
                  {lane.sfavorevoli.map((row) => (
                    <MatchupPlayerCard
                      key={row.matchupId}
                      row={row}
                      selected={open?.matchupId === row.matchupId}
                      onSelect={() => setOpen(row)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nessun profilo sfavorevole in evidenza per questo ruolo.</p>
              )}
            </section>
          ) : null}
          {!visibleCount && bucket === "all" ? (
            <p className="text-sm text-slate-500">Nessun profilo abbastanza solido in evidenza per questa fascia.</p>
          ) : null}
        </div>
      ) : null}
      {open ? (
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            PitchBrain Fanta Matchup Score
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{open.playerName}</h2>
          <p className="text-sm text-slate-300">
            {open.roleLabel}
            {open.mantra ? ` · ${open.mantra}` : ""} · Score {open.dailyScore}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            vs {open.nextOpponentName ?? "n.d."}
            {open.defenderLane === "fullback" && open.markingOpponentName ? ` · Contro ${open.markingOpponentName}` : ""}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">{open.headline}</p>
        </section>
      ) : null}
    </div>
  );
}
