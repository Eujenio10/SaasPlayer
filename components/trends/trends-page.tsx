"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendDeltaBadge, TrendSparkline } from "@/components/trends/trend-sparkline";
import { KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT } from "@/lib/kiosk-persisted-insights";
import { useWebCompetitionsWithMatches } from "@/components/competitions/use-web-competitions-with-matches";
import { resolveCompetitionId } from "@/lib/competitions";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { translateTeamName } from "@/lib/italian-sports-display";
import { reliabilityLabelIt } from "@/lib/trends/reasons";
import {
  metricLabelIt,
  metricUnitIt,
  TREND_EMPTY_STATE,
  TREND_DB_NOT_READY,
  TREND_PAGE_INTRO,
  TREND_PAGE_SUBTITLE,
  trendLevelColorClass,
  trendScoreLevelLabel
} from "@/lib/trends/text";
import type { PlayerTrend } from "@/lib/trends/types";

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

export function TrendsPage() {
  const { competitions: availableCompetitions, preferredId } = useWebCompetitionsWithMatches();
  const [competitionId, setCompetitionId] = useState(DEFAULT_MENU_COMPETITION_ID);
  const [round, setRound] = useState("");
  const [metric, setMetric] = useState<"all" | "shots" | "shots_on_target" | "saves">("all");
  const [reliability, setReliability] = useState<"all" | "high" | "medium_high">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerTrend[]>([]);
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!preferredId) return;
    if (!availableCompetitions.some((c) => c.id === competitionId)) {
      setCompetitionId(preferredId);
    }
  }, [availableCompetitions, competitionId, preferredId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ competitionId, metric, reliability });
      if (round) params.set("round", round);
      const res = await fetch(`/api/trends?${params.toString()}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as {
        results?: PlayerTrend[];
        availableRounds?: string[];
        updatedAt?: string | null;
        round?: string;
        trendDatabaseReady?: boolean;
      };
      setResults(Array.isArray(json.results) ? json.results : []);
      setAvailableRounds(Array.isArray(json.availableRounds) ? json.availableRounds : []);
      setUpdatedAt(json.updatedAt ?? null);
      if (!round && json.round) setRound(String(json.round));
      if (!json.results?.length && json.trendDatabaseReady === false) {
        setError(TREND_DB_NOT_READY);
      }
    } catch {
      setError("Impossibile caricare i Trend.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId, round, metric, reliability]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onRefresh);
  }, [load]);

  const hero = results[0] ?? null;
  const rest = useMemo(() => results.slice(1), [results]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-amber-400/10 via-white/[0.04] to-fuchsia-400/10 p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
          Pre-partita
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Trend</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">{TREND_PAGE_SUBTITLE}</p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">{TREND_PAGE_INTRO}</p>
        <p className="mt-4 text-xs text-slate-500">Aggiornato: {formatUpdatedAt(updatedAt)}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <select
            value={competitionId}
            onChange={(e) => {
              const next = resolveCompetitionId(e.target.value);
              if (next) setCompetitionId(next);
            }}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            {availableCompetitions.map((c) => (
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
            {availableRounds.map((r) => (
              <option key={r} value={r}>
                Giornata {r}
              </option>
            ))}
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="all">Tutti</option>
            <option value="shots">Tiri</option>
            <option value="shots_on_target">Tiri in porta</option>
            <option value="saves">Parate</option>
          </select>
          <select
            value={reliability}
            onChange={(e) => setReliability(e.target.value as typeof reliability)}
            className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="all">Affidabilità: tutte</option>
            <option value="medium_high">Medio-alta+</option>
            <option value="high">Alta</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6 text-rose-100">{error}</div>
      ) : !results.length ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
          {TREND_EMPTY_STATE}
        </div>
      ) : (
        <>
          {hero ? (
            <section className="overflow-hidden rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-amber-400/10 via-slate-950/50 to-fuchsia-500/10 p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Trend del giorno</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">{hero.playerName}</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {translateTeamName(hero.teamName)} · vs {translateTeamName(hero.opponentName)}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {metricLabelIt(hero.metric)} / 90
                  </p>
                  <div className="mt-2 grid max-w-md grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Baseline stagionale</p>
                      <p className="text-2xl font-semibold text-white">{hero.baseline.per90.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Ultime 5</p>
                      <p className="text-2xl font-semibold text-amber-200">{hero.recent.per90.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <TrendDeltaBadge
                      absolute={hero.absoluteDelta}
                      relative={hero.relativeDelta}
                      metric={hero.metric}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className={`text-lg font-bold ${trendLevelColorClass(hero.trendLevel)}`}>
                      Trend Score {hero.trendScore}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {trendScoreLevelLabel(hero.trendScore)}
                    </span>
                    <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs text-cyan-100">
                      Affidabilità {reliabilityLabelIt(hero.reliabilityScore)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    Sopra la media in {hero.recent.matchesAboveBaseline} delle ultime 5
                  </p>
                  <Link
                    href={`/kiosk/trend/${encodeURIComponent(hero.id)}`}
                    className="mt-5 inline-flex rounded-xl bg-amber-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                  >
                    Apri analisi
                  </Link>
                </div>
                <TrendSparkline
                  values={hero.recent.valuesByMatch}
                  baselinePer90={hero.baseline.per90}
                  minutes={hero.recent.minutesByMatch}
                />
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((item, index) => (
              <Link
                key={item.id}
                href={`/kiosk/trend/${encodeURIComponent(item.id)}`}
                className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-amber-300/30 hover:bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">#{index + 2}</p>
                    <h3 className="text-lg font-semibold text-white">{item.playerName}</h3>
                    <p className="text-xs text-slate-400">{translateTeamName(item.teamName)}</p>
                  </div>
                  <span className={`text-sm font-bold ${trendLevelColorClass(item.trendLevel)}`}>
                    {item.trendScore}
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {metricLabelIt(item.metric)} · {metricUnitIt(item.metric)}
                </p>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Baseline {item.baseline.per90.toFixed(1)}</p>
                    <p className="text-lg font-semibold text-amber-100">{item.recent.per90.toFixed(1)}</p>
                  </div>
                  <p className="text-sm font-semibold text-orange-300">+{Math.round(item.relativeDelta * 100)}%</p>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {item.recent.matchesAboveBaseline}/5 sopra la media · {reliabilityLabelIt(item.reliabilityScore)}
                </p>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
