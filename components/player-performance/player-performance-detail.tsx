"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { historySparklineValues } from "@/lib/player-performance/selectors";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";
import { roleGroupLabelIt } from "@/lib/player-performance/roles";
import {
  badgeLabelIt,
  consistencyLabelIt,
  finishingFormLabelIt,
  formatIndex,
  formatPercent,
  formatTrendPercent,
  PLAYER_PERFORMANCE_TEXT,
  reliabilityLabelIt,
  roleChangeLabelIt,
  trendStatusLabelIt
} from "@/lib/player-performance/text";
import { PlayerPerformanceSparkline } from "@/components/player-performance/player-performance-sparkline";

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="max-w-[58%] text-sm leading-snug text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold leading-snug text-white">{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function PlayerPerformanceDetailModal({
  player,
  isHomeTeam,
  onClose
}: {
  player: PlayerPerformanceItem | null;
  isHomeTeam: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!player) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [player, onClose]);

  const handleBackdropClose = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  if (!player || !mounted) return null;

  const minutes = (player.recent.minutes ?? 0) + (player.baseline?.minutes ?? 0);
  const contextPerf = isHomeTeam ? player.context?.homePerformance : player.context?.awayPerformance;
  const contextLabel = isHomeTeam
    ? PLAYER_PERFORMANCE_TEXT.homeContext
    : PLAYER_PERFORMANCE_TEXT.awayContext;

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] flex items-stretch justify-center bg-[#050814]/94 sm:items-center sm:p-4"
      role="presentation"
      onClick={handleBackdropClose}
    >
      <div
        className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-[#0A1628] shadow-2xl sm:h-auto sm:max-h-[min(92dvh,900px)] sm:rounded-3xl sm:border sm:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-performance-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 bg-[#0A1628] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {player.playerPhoto ? (
                <img
                  src={player.playerPhoto}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
                  {player.playerName.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <h3 id="player-performance-detail-title" className="text-lg font-bold leading-tight text-white">
                  {player.playerName}
                </h3>
                <p className="mt-0.5 text-sm text-slate-400">
                  {roleGroupLabelIt(player.roleGroup)} · {player.teamName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white touch-manipulation hover:bg-white/15"
              aria-label={PLAYER_PERFORMANCE_TEXT.closeDetail}
            >
              <X className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Chiudi</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-4">
            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.detailOverview}>
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.dangerIndex} value={formatIndex(player.dangerIndex)} />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend}
                value={`${trendStatusLabelIt(player.trendStatus)} (${formatTrendPercent(player.offensiveTrend)})`}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.shotThreatIndex}
                value={formatIndex(player.shooting?.shotThreatIndex ?? null)}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.creatorIndex}
                value={formatIndex(player.creation?.creatorIndex ?? null)}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.oneVsOneThreatIndex}
                value={formatIndex(player.oneVsOne?.oneVsOneThreatIndex ?? null)}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.consistencyScore}
                value={`${formatIndex(player.consistency?.score ?? null)} · ${consistencyLabelIt(player.consistency?.classification ?? null)}`}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.matchupScore}
                value={formatIndex(player.context?.matchupScore ?? null)}
              />
              {player.badges?.length ? (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {player.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                    >
                      {badgeLabelIt(badge)}
                    </span>
                  ))}
                </div>
              ) : null}
              {player.insight ? <p className="pt-2 text-sm leading-relaxed text-slate-400">{player.insight}</p> : null}
              <p className="pt-2 text-xs text-slate-500">
                {reliabilityLabelIt(player.dataReliability)} ·{" "}
                {PLAYER_PERFORMANCE_TEXT.reliabilityDetail(
                  player.reliabilityDetail?.appearances ?? player.recent.appearances,
                  minutes
                )}
              </p>
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.shooting}>
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotsPer90} value={player.shooting?.shotsPer90.toFixed(1) ?? "—"} />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}
                value={player.shooting?.shotsOnTargetPer90.toFixed(1) ?? "—"}
              />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotAccuracy} value={formatPercent(player.shooting?.shotAccuracy)} />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.goalsPer90} value={player.shooting?.goalsPer90.toFixed(1) ?? "—"} />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotConversion} value={formatPercent(player.shooting?.shotConversion)} />
              <PlayerPerformanceSparkline metric="shots" values={historySparklineValues(player, "shots")} className="pt-2" />
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.creation}>
              {player.creation?.limitedCoverage ? (
                <p className="mb-2 text-sm text-amber-200/90">{PLAYER_PERFORMANCE_TEXT.limitedCreatorCoverage}</p>
              ) : null}
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.keyPassesPer90}
                value={player.creation?.keyPassesPer90?.toFixed(1) ?? "—"}
              />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.assistsPer90} value={player.creation?.assistsPer90.toFixed(1) ?? "—"} />
              <PlayerPerformanceSparkline metric="keyPasses" values={historySparklineValues(player, "keyPasses")} className="pt-2" />
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.oneVsOne}>
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.dribbleAttemptsPer90}
                value={player.oneVsOne?.dribbleAttemptsPer90?.toFixed(1) ?? "—"}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.dribbleSuccessPer90}
                value={player.oneVsOne?.successfulDribblesPer90?.toFixed(1) ?? "—"}
              />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.dribbleSuccessRate}
                value={formatPercent(player.oneVsOne?.dribbleSuccessRate)}
              />
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.trends}>
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last3} value={player.trendWindows?.shotsPer90Last3?.toFixed(1) ?? "—"} />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last5} value={player.trendWindows?.shotsPer90Last5?.toFixed(1) ?? "—"} />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last10} value={player.trendWindows?.shotsPer90Last10?.toFixed(1) ?? "—"} />
              {player.finishingForm ? (
                <MetricRow label="Forma realizzativa" value={finishingFormLabelIt(player.finishingForm.status)} />
              ) : null}
              {player.ratingTrend?.recentAverage != null ? (
                <>
                  <MetricRow
                    label={PLAYER_PERFORMANCE_TEXT.indices.ratingAverage}
                    value={`${player.ratingTrend.recentAverage.toFixed(1)} (${player.ratingTrend.difference != null ? (player.ratingTrend.difference >= 0 ? "+" : "") + player.ratingTrend.difference.toFixed(1) : "—"})`}
                  />
                  <MetricRow
                    label={PLAYER_PERFORMANCE_TEXT.detail.matchesAboveSeven}
                    value={String(player.ratingTrend.matchesAboveSeven)}
                  />
                </>
              ) : null}
              <PlayerPerformanceSparkline metric="rating" values={historySparklineValues(player, "rating")} className="pt-2" />
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.usage}>
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.startPercentage} value={formatPercent(player.usage?.startPercentage)} />
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.averageMinutes} value={player.usage?.averageMinutes.toFixed(0) ?? "—"} />
              {player.usage?.starterShotsPer90 != null ? (
                <MetricRow
                  label={PLAYER_PERFORMANCE_TEXT.detail.starterPerformance}
                  value={`${player.usage.starterShotsPer90.toFixed(1)} tiri/90`}
                />
              ) : null}
              {player.usage?.substituteShotsPer90 != null ? (
                <MetricRow
                  label={PLAYER_PERFORMANCE_TEXT.detail.substitutePerformance}
                  value={`${player.usage.substituteShotsPer90.toFixed(1)} tiri/90`}
                />
              ) : null}
              {roleChangeLabelIt(player.context?.roleChange) ? (
                <p className="pt-2 text-sm text-amber-200/90">{roleChangeLabelIt(player.context?.roleChange)}</p>
              ) : null}
            </DetailSection>

            <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.context}>
              {contextPerf ? (
                <>
                  <p className="mb-1 text-sm font-semibold text-white">{contextLabel}</p>
                  <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotsPer90} value={contextPerf.shotsPer90?.toFixed(1) ?? "—"} />
                  <MetricRow
                    label={PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}
                    value={contextPerf.shotsOnTargetPer90?.toFixed(1) ?? "—"}
                  />
                </>
              ) : null}
              <p className="pt-2 text-xs leading-relaxed text-slate-500">{PLAYER_PERFORMANCE_TEXT.detail.methodologyNote}</p>
            </DetailSection>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#0A1628] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-cyan-400/15 py-3.5 text-center text-sm font-bold text-cyan-100 touch-manipulation hover:bg-cyan-400/25"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
