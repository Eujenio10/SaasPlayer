"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchRadarDetailResponse } from "@/lib/match-radar/types";
import { MATCH_RADAR_UI_TEXT, translateMatchRadarReason } from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";
import { translateCompetitionName, translateTeamName } from "@/lib/italian-sports-display";

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-cyan-400/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function MatchRadarDetailPage({
  matchId,
  isPro = false
}: {
  matchId: string;
  isPro?: boolean;
}) {
  const locale: "it" | "en" = "it";
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const [detail, setDetail] = useState<MatchRadarDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/match-radar/${encodeURIComponent(matchId)}?locale=${locale}`, {
          cache: "no-store",
          credentials: "include"
        });
        if (!res.ok) {
          setDetail(null);
          return;
        }
        const json = (await res.json()) as { detail?: MatchRadarDetailResponse };
        setDetail(json.detail ?? null);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, locale]);

  if (loading) return <p className="text-slate-400">{ui.loading}</p>;
  if (!detail) return <p className="text-slate-400">{ui.empty}</p>;

  const dimensions = [
    { key: "intensity", label: ui.dimensions.intensity, value: detail.dimensions.intensity },
    {
      key: "attackingPotential",
      label: ui.dimensions.attackingPotential,
      value: detail.dimensions.attackingPotential
    },
    { key: "balance", label: ui.dimensions.balance, value: detail.dimensions.balance },
    { key: "volatility", label: ui.dimensions.volatility, value: detail.dimensions.volatility },
    {
      key: "tacticalMismatch",
      label: ui.dimensions.tacticalMismatch,
      value: detail.dimensions.tacticalMismatch
    },
    {
      key: "refereeStrictness",
      label: ui.dimensions.refereeStrictness,
      value: detail.dimensions.refereeStrictness
    }
  ].filter((d) => d.value != null);

  const maxReasons = isPro ? detail.reasons.length : 2;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/kiosk/match-radar" className="text-sm text-cyan-300">
        ← Match Radar
      </Link>
      <p className="mt-4 text-xs text-slate-400">
        {translateCompetitionName(detail.competitionId)} · {formatKickoffInRome(detail.kickoff, locale)}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">
        {translateTeamName(detail.homeTeam.name)} vs {translateTeamName(detail.awayTeam.name)}
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        {ui.radarScore}: <span className="font-bold text-cyan-200">{detail.radarScore}/100</span> ·{" "}
        {ui.confidence[detail.confidenceLevel]}
      </p>

      <div className="mt-6 space-y-3">
        {dimensions.slice(0, isPro ? dimensions.length : 2).map((d) => (
          <ScoreBar key={d.key} label={d.label} value={d.value} />
        ))}
      </div>

      {detail.referee?.strictnessScore != null ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            {ui.refereeSectionTitle}
          </h2>
          <p className="mt-2 text-sm font-semibold text-white">
            {detail.referee.foulsPerMatch ?? "—"} falli/partita · {detail.referee.yellowCardsPerMatch ?? "—"}{" "}
            gialli/partita
            {detail.referee.redCardsPerMatch != null ? ` · ${detail.referee.redCardsPerMatch} rossi/partita` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Campione: {detail.referee.matchesSample} gare · Severità {detail.referee.strictnessScore}/100
          </p>
          {detail.referee.foulsVsCompetitionPct != null &&
          detail.referee.yellowCardsVsCompetitionPct != null ? (
            <p className="mt-2 text-xs text-amber-200/90">
              {ui.refereeVsCompetitionNote(
                detail.referee.foulsVsCompetitionPct,
                detail.referee.yellowCardsVsCompetitionPct
              )}
            </p>
          ) : null}
          {detail.refereeBoost != null && detail.refereeBoost > 0 ? (
            <p className="mt-2 text-xs text-cyan-200/90">{ui.refereeBoostNote(detail.refereeBoost)}</p>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-amber-200/90">{ui.whyTitle}</h2>
      <ul className="mt-2 space-y-2 text-sm text-slate-200">
        {detail.reasons.slice(0, maxReasons).map((reason) => (
          <li key={reason.key}>• {translateMatchRadarReason(reason, locale)}</li>
        ))}
      </ul>

      {detail.matchupInsights.length > 0 ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            {ui.matchupInsightsTitle}
          </h2>
          {detail.matchupSampleNote ? (
            <p className="mt-2 text-xs text-slate-400">{detail.matchupSampleNote}</p>
          ) : null}
          <div className="mt-4 space-y-4">
            {detail.matchupInsights.map((row) => (
              <div key={row.id} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-white">{row.label}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {translateTeamName(detail.homeTeam.name)} · {row.homeCaption}
                    </p>
                    <p className="text-lg font-bold text-cyan-200">{row.homeDisplay}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {translateTeamName(detail.awayTeam.name)} · {row.awayCaption}
                    </p>
                    <p className="text-lg font-bold text-cyan-200">{row.awayDisplay}</p>
                  </div>
                </div>
                {row.insight ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{row.insight}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
