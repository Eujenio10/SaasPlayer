"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { MONITORED_COMPETITIONS } from "@/lib/competitions";
import { translateTeamName } from "@/lib/italian-sports-display";
import { reliabilityLabelIt } from "@/lib/match-simulator/reliability";
import {
  MATCH_SIMULATOR_DB_NOT_READY,
  MATCH_SIMULATOR_LOAD_ERROR,
  MATCH_SIMULATOR_PAGE_SUBTITLE,
  MATCH_SIMULATOR_PAGE_TITLE
} from "@/lib/match-simulator/text";
import type { MatchSimulatorFixtureListItem } from "@/lib/match-simulator/types";

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function statusLabel(status: MatchSimulatorFixtureListItem["simulationStatus"]): string {
  switch (status) {
    case "ready":
      return "Simulazione disponibile";
    case "missing":
      return "Simulazione non generata";
    case "insufficient_data":
      return "Dati insufficienti";
    case "stale":
      return "Simulazione da aggiornare";
    case "live":
      return "Partita in corso";
    case "postponed":
      return "Partita rinviata";
    default:
      return status;
  }
}

export function MatchSimulatorListPage() {
  const [competitionId, setCompetitionId] = useState("serie-a");
  const [round, setRound] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<MatchSimulatorFixtureListItem[]>([]);
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [simulatorDatabaseReady, setSimulatorDatabaseReady] = useState(true);

  useEffect(() => {
    setRound("");
  }, [competitionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ competitionId });
      if (round) params.set("round", round);
      const res = await fetch(`/api/match-simulator/fixtures?${params.toString()}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as {
        fixtures?: MatchSimulatorFixtureListItem[];
        availableRounds?: string[];
        updatedAt?: string | null;
        round?: string;
        simulatorDatabaseReady?: boolean;
      };
      setFixtures(Array.isArray(json.fixtures) ? json.fixtures : []);
      setAvailableRounds(Array.isArray(json.availableRounds) ? json.availableRounds : []);
      setUpdatedAt(json.updatedAt ?? null);
      setSimulatorDatabaseReady(json.simulatorDatabaseReady !== false);
      if (json.round && !round) setRound(String(json.round));
    } catch {
      setError(MATCH_SIMULATOR_LOAD_ERROR);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId, round]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.04] to-emerald-400/10 p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
          Pre-partita
        </p>
        <div className="flex items-start gap-3">
          <Activity className="mt-1 h-8 w-8 text-cyan-300" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {MATCH_SIMULATOR_PAGE_TITLE}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              {MATCH_SIMULATOR_PAGE_SUBTITLE}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Aggiornato: {formatUpdatedAt(updatedAt)}</p>
        {!simulatorDatabaseReady ? (
          <p className="mt-2 text-xs text-amber-200/90">{MATCH_SIMULATOR_DB_NOT_READY}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <select
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            {MONITORED_COMPETITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="">Tutte le partite</option>
            {availableRounds.map((r) => (
              <option key={r} value={r}>
                Calendario {r}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6 text-rose-100">{error}</div>
      ) : !fixtures.length ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
          Nessuna partita disponibile per il filtro selezionato.
        </div>
      ) : (
        <div className="grid gap-4">
          {fixtures.map((fixture) => (
            <article
              key={fixture.fixtureId}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {formatKickoff(fixture.kickoffIso)}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {translateTeamName(fixture.homeTeam.name)} — {translateTeamName(fixture.awayTeam.name)}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">
                      {statusLabel(fixture.simulationStatus)}
                    </span>
                    {fixture.reliabilityLabel ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                        Affidabilità {reliabilityLabelIt(fixture.reliabilityLabel)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/kiosk/simulatore-match/${fixture.fixtureId}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400/15 px-5 py-3 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-300/20 transition hover:bg-cyan-400/20"
                >
                  {fixture.simulationStatus === "ready" ? "Apri simulazione" : "Simula partita"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
