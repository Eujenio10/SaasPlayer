"use client";

import { Filter } from "lucide-react";
import { useMemo, useId } from "react";
import type { FoulRiskEntry } from "@/lib/foul-risk-analysis";

const selectCls =
  "rounded-xl border border-[rgba(120,170,255,0.22)] bg-[rgba(8,16,32,0.95)] px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-inner outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/40";

interface UpcomingBrief {
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
}

export function normalizePlayerKey(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toUpperCase();
}

interface FoulCommittedFilterBarProps {
  entries: FoulRiskEntry[];
  leagueSlugs: string[];
  selectedLeagueNormalized: string;
  onSelectLeague: (slug: string) => void;
  leagueLabelFn: (slug: string) => string;
  selectedMatch: UpcomingBrief | null;
  teamScope: "all" | "home" | "away";
  onTeamScopeChange: (v: "all" | "home" | "away") => void;
  playerKey: string;
  onPlayerKeyChange: (v: string) => void;
}

export function FoulCommittedFilterBar({
  entries,
  leagueSlugs,
  selectedLeagueNormalized,
  onSelectLeague,
  leagueLabelFn,
  selectedMatch,
  teamScope,
  onTeamScopeChange,
  playerKey,
  onPlayerKeyChange
}: FoulCommittedFilterBarProps) {
  const advId = useId();

  const selectedValue = leagueSlugs.includes(selectedLeagueNormalized) ? selectedLeagueNormalized : "";

  const playerOptions = useMemo(() => {
    const narrowed =
      selectedMatch && teamScope !== "all"
        ? entries.filter((e) =>
            teamScope === "home" ? e.teamId === selectedMatch.homeTeam.id : e.teamId === selectedMatch.awayTeam.id
          )
        : entries;
    const set = new Set<string>();
    for (const e of narrowed) set.add(normalizePlayerKey(e.playerName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries, selectedMatch, teamScope]);

  return (
    <div className="rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.65)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex min-w-[160px] flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Competizione</span>
            <select
              className={`${selectCls} w-full`}
              value={selectedValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onSelectLeague(v);
              }}
              disabled={leagueSlugs.length === 0}
            >
              {selectedValue ? null : (
                <option value="" disabled>
                  Seleziona campionato
                </option>
              )}
              {leagueSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {leagueLabelFn(slug)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[160px] flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Squadra</span>
            <select
              className={`${selectCls} w-full`}
              disabled={!selectedMatch}
              value={teamScope}
              onChange={(e) => onTeamScopeChange(e.target.value as "all" | "home" | "away")}
            >
              <option value="all">Tutte</option>
              {selectedMatch ? (
                <>
                  <option value="home">{selectedMatch.homeTeam.name}</option>
                  <option value="away">{selectedMatch.awayTeam.name}</option>
                </>
              ) : null}
            </select>
          </label>

          <label className="flex min-w-[160px] flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Giocatore</span>
            <select
              className={`${selectCls} w-full`}
              value={playerKey}
              onChange={(e) => onPlayerKeyChange(e.target.value)}
            >
              <option value="">Tutti</option>
              {playerOptions.map((k) => {
                const nice = entries.find((e) => normalizePlayerKey(e.playerName) === k)?.playerName ?? k;
                return (
                  <option key={k} value={k}>
                    {nice}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="flex min-w-[160px] items-end">
            <details className="group w-full">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[rgba(120,170,255,0.22)] bg-gradient-to-br from-cyan-500/12 to-blue-600/10 px-4 py-2.5 text-sm font-bold text-slate-100 hover:border-cyan-400/40 [&::-webkit-details-marker]:hidden">
                <Filter className="h-4 w-4 text-cyan-300" />
                Filtri avanzati
              </summary>
              <div
                id={advId}
                className="mt-3 rounded-xl border border-white/10 bg-[#040B14]/80 p-4 text-xs text-slate-400"
              >
                <p className="font-semibold text-slate-200">Informazioni operative</p>
                <p className="mt-2 leading-relaxed">
                  Le soglie di mercato sulle carte e sui falli (Over/Under) restano disponibili espandendo ogni scheda:
                  leggi nel blocco &quot;Soglie quote&quot; i valori ricavati dalle statistiche già aggiornate.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export function committedFilterRows(
  entries: FoulRiskEntry[],
  opts: { teamScope: "all" | "home" | "away"; playerKey: string; match: UpcomingBrief | null }
): FoulRiskEntry[] {
  const { teamScope, playerKey, match } = opts;
  return entries.filter((e) => {
    if (match && teamScope !== "all") {
      const want =
        teamScope === "home" ? match.homeTeam.id : match.awayTeam.id;
      if (e.teamId !== want) return false;
    }
    if (playerKey && normalizePlayerKey(e.playerName) !== playerKey) return false;
    return true;
  });
}
