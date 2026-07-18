"use client";

import type { PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import { historySparklineValues } from "@/lib/player-performance/selectors";
import type { PlayerPerformanceCategory, PlayerPerformanceItem } from "@/lib/player-performance/types";
import { roleGroupLabelIt } from "@/lib/player-performance/roles";
import {
  badgeLabelIt,
  formatIndex,
  formatPercent,
  formatTrendPercent,
  PLAYER_PERFORMANCE_TEXT,
  reliabilityLabelIt,
  trendArrow,
  trendStatusLabelIt
} from "@/lib/player-performance/text";
import { PlayerPerformanceSparkline } from "@/components/player-performance/player-performance-sparkline";

function trendClass(status: PlayerPerformanceItem["trendStatus"]): string {
  if (status === "strong_growth" || status === "growth") return "text-emerald-300";
  if (status === "decline" || status === "strong_decline") return "text-rose-300";
  return "text-slate-300";
}

function primaryIndex(
  item: PlayerPerformanceItem,
  mainTab: PlayerPerformanceMainTab,
  category: PlayerPerformanceCategory
): { label: string; value: string } {
  if (mainTab === "shooting") {
    return {
      label: PLAYER_PERFORMANCE_TEXT.indices.shotThreatIndex,
      value: formatIndex(item.shooting?.shotThreatIndex)
    };
  }
  if (mainTab === "creation") {
    const creator = item.creation?.creatorIndex ?? 0;
    const oneVsOne = item.oneVsOne?.oneVsOneThreatIndex ?? 0;
    if (oneVsOne > creator) {
      return {
        label: PLAYER_PERFORMANCE_TEXT.indices.oneVsOneThreatIndex,
        value: formatIndex(item.oneVsOne?.oneVsOneThreatIndex)
      };
    }
    return {
      label: PLAYER_PERFORMANCE_TEXT.indices.creatorIndex,
      value: formatIndex(item.creation?.creatorIndex)
    };
  }
  if (mainTab === "trends") {
    return {
      label: PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend,
      value: formatTrendPercent(item.offensiveTrend)
    };
  }
  if (category === "dangerous") {
    return {
      label: PLAYER_PERFORMANCE_TEXT.indices.dangerIndex,
      value: formatIndex(item.dangerIndex)
    };
  }
  return {
    label: PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend,
    value: formatTrendPercent(item.offensiveTrend)
  };
}

function sparklineMetric(
  mainTab: PlayerPerformanceMainTab,
  category: PlayerPerformanceCategory
): "shots" | "shotsOnTarget" | "keyPasses" | "rating" {
  if (mainTab === "creation") return "keyPasses";
  if (mainTab === "trends" && category === "declining") return "shotsOnTarget";
  return "shots";
}

function secondaryStats(
  item: PlayerPerformanceItem,
  mainTab: PlayerPerformanceMainTab
): string[] {
  const shooting = item.shooting;
  const creation = item.creation;
  const oneVsOne = item.oneVsOne;
  if (mainTab === "shooting") {
    return [
      `${PLAYER_PERFORMANCE_TEXT.indices.shotsPer90}: ${shooting?.shotsPer90.toFixed(1) ?? "—"}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}: ${shooting?.shotsOnTargetPer90.toFixed(1) ?? "—"}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.shotAccuracy}: ${formatPercent(shooting?.shotAccuracy)}`
    ];
  }
  if (mainTab === "creation") {
    return [
      `${PLAYER_PERFORMANCE_TEXT.indices.keyPassesPer90}: ${creation?.keyPassesPer90?.toFixed(1) ?? "—"}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.assistsPer90}: ${creation?.assistsPer90.toFixed(1) ?? "—"}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.dribbleSuccessPer90}: ${oneVsOne?.successfulDribblesPer90?.toFixed(1) ?? "—"}`
    ];
  }
  if (mainTab === "trends") {
    return [
      `${PLAYER_PERFORMANCE_TEXT.indices.consistencyScore}: ${formatIndex(item.consistency?.score)}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.shotsPer90}: ${item.recent.shotsPer90.toFixed(1)}`,
      `${PLAYER_PERFORMANCE_TEXT.indices.ratingAverage}: ${item.ratingTrend?.recentAverage?.toFixed(1) ?? "—"}`
    ];
  }
  return [
    `${PLAYER_PERFORMANCE_TEXT.indices.shotsPer90}: ${(item.combined ?? item.recent).shotsPer90.toFixed(1)}`,
    `${PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}: ${(item.combined ?? item.recent).shotsOnTargetPer90.toFixed(1)}`,
    `${PLAYER_PERFORMANCE_TEXT.indices.keyPassesPer90}: ${(item.combined ?? item.recent).keyPassesPer90?.toFixed(1) ?? "—"}`
  ];
}

export function PlayerPerformanceCard({
  item,
  mainTab,
  category,
  onSelect
}: {
  item: PlayerPerformanceItem;
  mainTab: PlayerPerformanceMainTab;
  category: PlayerPerformanceCategory;
  onSelect: (item: PlayerPerformanceItem) => void;
}) {
  const index = primaryIndex(item, mainTab, category);
  const metric = sparklineMetric(mainTab, category);
  const sparkValues = historySparklineValues(item, metric);
  const minutes = (item.recent.minutes ?? 0) + (item.baseline?.minutes ?? 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-left transition hover:border-cyan-300/30 hover:bg-slate-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      aria-label={`${PLAYER_PERFORMANCE_TEXT.openDetail}: ${item.playerName}`}
    >
      <div className="flex items-center gap-3">
        {item.playerPhoto ? (
          <img src={item.playerPhoto} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
            {item.playerName.slice(0, 1)}
          </div>
        )}
        <div>
          <p className="font-bold text-white">{item.playerName}</p>
          <p className="text-xs text-slate-400">
            {roleGroupLabelIt(item.roleGroup)} · {item.teamName}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p className="font-bold text-cyan-200">
          {index.label}: {index.value}
        </p>
        {item.offensiveTrend != null && mainTab !== "trends" ? (
          <p className={`font-semibold ${trendClass(item.trendStatus)}`}>
            <span aria-hidden>{trendArrow(item.trendStatus)} </span>
            {trendStatusLabelIt(item.trendStatus)}: {formatTrendPercent(item.offensiveTrend)}
          </p>
        ) : null}
        {secondaryStats(item, mainTab).map((line) => (
          <p key={line} className="text-slate-300">
            {line}
          </p>
        ))}
      </div>

      {sparkValues.length ? (
        <PlayerPerformanceSparkline metric={metric} values={sparkValues} className="mt-3" />
      ) : null}

      {item.badges?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.badges.slice(0, 4).map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
            >
              {badgeLabelIt(badge)}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        {reliabilityLabelIt(item.dataReliability)} · {minutes} {PLAYER_PERFORMANCE_TEXT.minutesAnalyzed}
      </p>
      {item.insight ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.insight}</p> : null}
    </button>
  );
}
