"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Radar } from "lucide-react";
import type { MatchRadarApiResponse } from "@/lib/match-radar/api-handlers";
import type { MatchRadarMode } from "@/lib/match-radar/config";
import { translateCompetitionName } from "@/lib/italian-sports-display";
import { translateMatchRadarReason, MATCH_RADAR_UI_TEXT, matchRadarEmptyMessage } from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-400/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function MatchRadarHomeSection({
  isPro = false,
  compact = false
}: {
  isPro?: boolean;
  compact?: boolean;
}) {
  const locale: "it" | "en" = "it";
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const [mode, setMode] = useState<MatchRadarMode>("general");
  const [data, setData] = useState<MatchRadarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/match-radar?mode=${mode}&locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch_failed");
      const json = (await res.json()) as MatchRadarApiResponse;
      setData(json);
    } catch {
      setError(ui.error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode, ui.error]);

  useEffect(() => {
    void load();
  }, [load]);

  const modes = useMemo(
    () => data?.ui?.modes ?? (Object.keys(ui.modes) as MatchRadarMode[]).map((id) => ({ id, label: ui.modes[id] })),
    [data?.ui?.modes, ui.modes]
  );

  const matches = compact ? (data?.matches ?? []).slice(0, 1) : (data?.matches ?? []);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 ring-1 ring-white/5">
      {!compact ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-cyan-200">
                <Radar className="h-4 w-4" aria-hidden />
                <h2 className="text-lg font-bold">{ui.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{ui.screenIntro}</p>
              <p className="mt-1 text-sm text-slate-400">{ui.subtitle}</p>
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  mode === item.id
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mb-3 text-sm text-slate-400">{data?.ui?.subtitle ?? ui.subtitle}</p>
      )}

      {loading ? <p className="text-sm text-slate-400">{ui.loading}</p> : null}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {!loading && !error && data && !matches.length ? (
        <p className="text-sm text-slate-400">
          {matchRadarEmptyMessage(locale, data.emptyReason ?? null)}
        </p>
      ) : null}

      <div className="space-y-3">
        {matches.map((match) => (
          <Link
            key={match.matchId}
            href={`/kiosk/match-radar/${match.matchId}`}
            className="block rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-cyan-400/30"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                {translateCompetitionName(match.competitionId)} · {formatKickoffInRome(match.kickoff, locale)}
              </span>
              <span>{ui.confidence[match.confidenceLevel]}</span>
            </div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{match.homeTeam.name}</p>
                <p className="font-semibold text-white">{match.awayTeam.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{ui.radarScore}</p>
                <p className="text-2xl font-black tabular-nums text-cyan-200">{match.radarScore}/100</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ScoreBar label={ui.dimensions.intensity} value={match.dimensions.intensity} />
              <ScoreBar label={ui.dimensions.attackingPotential} value={match.dimensions.attackingPotential} />
              {isPro ? (
                <>
                  <ScoreBar label={ui.dimensions.balance} value={match.dimensions.balance} />
                  <ScoreBar label={ui.dimensions.refereeStrictness} value={match.dimensions.refereeStrictness} />
                </>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-amber-200/90">{ui.whyTitle}</p>
            <ul className="mt-1 space-y-1 text-xs text-slate-300">
              {match.reasons.slice(0, isPro ? 5 : 2).map((reason) => (
                <li key={reason.key}>• {translateMatchRadarReason(reason, locale)}</li>
              ))}
            </ul>
            {match.highlights?.combinedFoulsPerMatch != null ? (
              <p className="mt-2 text-[11px] text-slate-500">
                Falli combinati {match.highlights.combinedFoulsPerMatch}/partita
                {match.highlights.combinedCardsPerMatch != null
                  ? ` · Cartellini ${match.highlights.combinedCardsPerMatch}`
                  : ""}
                {match.highlights.combinedOffsidesPerMatch != null
                  ? ` · Fuorigioco ${match.highlights.combinedOffsidesPerMatch}`
                  : ""}
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      {data?.isLimitedPreview ? (
        <p className="mt-3 text-xs text-amber-200/90">{ui.limitedPreview}</p>
      ) : null}
    </section>
  );
}
