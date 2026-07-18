"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendDeltaBadge, TrendSparkline } from "@/components/trends/trend-sparkline";
import { translateTeamName } from "@/lib/italian-sports-display";
import { reliabilityLabelIt } from "@/lib/trends/reasons";
import {
  availabilityLabelIt,
  metricLabelIt,
  metricUnitIt,
  TREND_METHODOLOGY_NOTE,
  trendLevelColorClass,
  trendScoreLevelLabel
} from "@/lib/trends/text";
import type { PlayerTrend } from "@/lib/trends/types";

export function TrendDetailPage(props: { trendId: string }) {
  const [trend, setTrend] = useState<PlayerTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/trends/${encodeURIComponent(props.trendId)}`, {
          cache: "no-store",
          credentials: "include"
        });
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as { trend?: PlayerTrend };
        if (!cancelled) setTrend(json.trend ?? null);
      } catch {
        if (!cancelled) {
          setError("Trend non trovato.");
          setTrend(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.trendId]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16"><div className="h-64 animate-pulse rounded-3xl bg-white/5" /></div>;
  }
  if (error || !trend) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-300">
        {error ?? "Trend non disponibile."}
        <div className="mt-4">
          <Link href="/kiosk/trend" className="text-amber-300 underline">Torna ai Trend</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-14">
      <Link href="/kiosk/trend" className="text-sm text-amber-200/80 hover:text-amber-100">
        ← Trend
      </Link>

      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-white">{trend.playerName}</h1>
        <p className="mt-1 text-slate-300">
          {translateTeamName(trend.teamName)} · prossima partita vs {translateTeamName(trend.opponentName)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">
            {metricLabelIt(trend.metric)}
          </span>
          <span className={`font-semibold ${trendLevelColorClass(trend.trendLevel)}`}>
            Trend Score {trend.trendScore} · {trendScoreLevelLabel(trend.trendScore)}
          </span>
          <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-cyan-100">
            Affidabilità {reliabilityLabelIt(trend.reliabilityScore)}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
            {availabilityLabelIt(trend.availabilityLabel)}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Baseline stagionale</p>
          <p className="mt-2 text-4xl font-bold text-white">{trend.baseline.per90.toFixed(1)}</p>
          <p className="text-sm text-slate-400">{metricUnitIt(trend.metric)}</p>
        </div>
        <div className="text-center">
          <TrendDeltaBadge absolute={trend.absoluteDelta} relative={trend.relativeDelta} metric={trend.metric} />
        </div>
        <div className="rounded-3xl border border-amber-300/20 bg-amber-400/5 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">Ultime cinque</p>
          <p className="mt-2 text-4xl font-bold text-amber-100">{trend.recent.per90.toFixed(1)}</p>
          <p className="text-sm text-slate-400">{metricUnitIt(trend.metric)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
        <h2 className="text-lg font-semibold text-white">Ultime 5 presenze</h2>
        <TrendSparkline
          className="mt-4"
          values={trend.recent.valuesByMatch}
          baselinePer90={trend.baseline.per90}
          minutes={trend.recent.minutesByMatch}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {trend.reasons.map((reason) => (
          <div key={reason.type} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold text-white">{reason.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{reason.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-white">Campione analizzato</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-medium text-slate-200">Ultime cinque</p>
            <p>{trend.recent.matches} presenze · {trend.recent.minutes} minuti</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Baseline</p>
            <p>{trend.baseline.matches} presenze · {trend.baseline.minutes} minuti</p>
          </div>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-slate-400">{TREND_METHODOLOGY_NOTE}</p>
      </section>
    </div>
  );
}
