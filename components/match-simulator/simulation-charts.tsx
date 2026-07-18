"use client";

import { formatExpected } from "@/lib/match-simulator/text";
import type { DistributionSummary } from "@/lib/match-simulator/types";

export interface MetricVisualTheme {
  titleClass: string;
  cardBorderClass: string;
  cardBgClass: string;
  homeDotClass: string;
  awayDotClass: string;
  homeFillClass: string;
  awayFillClass: string;
  homeTrackClass: string;
  awayTrackClass: string;
  meanTextClass: string;
  tabActiveClass: string;
}

const DEFAULT_THEME: MetricVisualTheme = {
  titleClass: "text-cyan-200",
  cardBorderClass: "border-cyan-400/25",
  cardBgClass: "bg-cyan-400/[0.06]",
  homeDotClass: "bg-sky-300 ring-sky-200/50 shadow-[0_0_14px_rgba(56,189,248,0.55)]",
  awayDotClass: "bg-emerald-300 ring-emerald-200/50 shadow-[0_0_14px_rgba(52,211,153,0.55)]",
  homeFillClass: "bg-sky-400/45",
  awayFillClass: "bg-emerald-400/45",
  homeTrackClass: "bg-sky-950/50 ring-1 ring-sky-400/20",
  awayTrackClass: "bg-emerald-950/50 ring-1 ring-emerald-400/20",
  meanTextClass: "text-cyan-100",
  tabActiveClass: "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-300/30"
};

export function getMetricVisualTheme(metricKey: string): MetricVisualTheme {
  switch (metricKey) {
    case "goals":
      return {
        titleClass: "text-cyan-200",
        cardBorderClass: "border-cyan-400/30",
        cardBgClass: "bg-cyan-400/[0.08]",
        homeDotClass: "bg-sky-300 ring-sky-100/60 shadow-[0_0_16px_rgba(56,189,248,0.65)]",
        awayDotClass: "bg-teal-300 ring-teal-100/60 shadow-[0_0_16px_rgba(45,212,191,0.65)]",
        homeFillClass: "bg-sky-400/50",
        awayFillClass: "bg-teal-400/50",
        homeTrackClass: "bg-sky-950/60 ring-1 ring-sky-400/25",
        awayTrackClass: "bg-teal-950/60 ring-1 ring-teal-400/25",
        meanTextClass: "text-cyan-100",
        tabActiveClass: "bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-300/35"
      };
    case "shots":
      return {
        titleClass: "text-blue-200",
        cardBorderClass: "border-blue-400/30",
        cardBgClass: "bg-blue-500/[0.08]",
        homeDotClass: "bg-blue-300 ring-blue-100/60 shadow-[0_0_16px_rgba(96,165,250,0.65)]",
        awayDotClass: "bg-indigo-300 ring-indigo-100/60 shadow-[0_0_16px_rgba(129,140,248,0.65)]",
        homeFillClass: "bg-blue-400/50",
        awayFillClass: "bg-indigo-400/50",
        homeTrackClass: "bg-blue-950/60 ring-1 ring-blue-400/25",
        awayTrackClass: "bg-indigo-950/60 ring-1 ring-indigo-400/25",
        meanTextClass: "text-blue-100",
        tabActiveClass: "bg-blue-400/20 text-blue-50 ring-1 ring-blue-300/35"
      };
    case "shotsOnTarget":
      return {
        titleClass: "text-violet-200",
        cardBorderClass: "border-violet-400/30",
        cardBgClass: "bg-violet-500/[0.08]",
        homeDotClass: "bg-violet-300 ring-violet-100/60 shadow-[0_0_16px_rgba(167,139,250,0.65)]",
        awayDotClass: "bg-purple-300 ring-purple-100/60 shadow-[0_0_16px_rgba(192,132,252,0.65)]",
        homeFillClass: "bg-violet-400/50",
        awayFillClass: "bg-purple-400/50",
        homeTrackClass: "bg-violet-950/60 ring-1 ring-violet-400/25",
        awayTrackClass: "bg-purple-950/60 ring-1 ring-purple-400/25",
        meanTextClass: "text-violet-100",
        tabActiveClass: "bg-violet-400/20 text-violet-50 ring-1 ring-violet-300/35"
      };
    case "corners":
      return {
        titleClass: "text-amber-200",
        cardBorderClass: "border-amber-400/30",
        cardBgClass: "bg-amber-500/[0.08]",
        homeDotClass: "bg-amber-300 ring-amber-100/60 shadow-[0_0_16px_rgba(251,191,36,0.65)]",
        awayDotClass: "bg-orange-300 ring-orange-100/60 shadow-[0_0_16px_rgba(251,146,60,0.65)]",
        homeFillClass: "bg-amber-400/50",
        awayFillClass: "bg-orange-400/50",
        homeTrackClass: "bg-amber-950/60 ring-1 ring-amber-400/25",
        awayTrackClass: "bg-orange-950/60 ring-1 ring-orange-400/25",
        meanTextClass: "text-amber-100",
        tabActiveClass: "bg-amber-400/20 text-amber-50 ring-1 ring-amber-300/35"
      };
    case "offsides":
      return {
        titleClass: "text-rose-200",
        cardBorderClass: "border-rose-400/30",
        cardBgClass: "bg-rose-500/[0.08]",
        homeDotClass: "bg-rose-300 ring-rose-100/60 shadow-[0_0_16px_rgba(251,113,133,0.65)]",
        awayDotClass: "bg-pink-300 ring-pink-100/60 shadow-[0_0_16px_rgba(244,114,182,0.65)]",
        homeFillClass: "bg-rose-400/50",
        awayFillClass: "bg-pink-400/50",
        homeTrackClass: "bg-rose-950/60 ring-1 ring-rose-400/25",
        awayTrackClass: "bg-pink-950/60 ring-1 ring-pink-400/25",
        meanTextClass: "text-rose-100",
        tabActiveClass: "bg-rose-400/20 text-rose-50 ring-1 ring-rose-300/35"
      };
    case "saves":
      return {
        titleClass: "text-teal-200",
        cardBorderClass: "border-teal-400/30",
        cardBgClass: "bg-teal-500/[0.08]",
        homeDotClass: "bg-teal-300 ring-teal-100/60 shadow-[0_0_16px_rgba(45,212,191,0.65)]",
        awayDotClass: "bg-cyan-300 ring-cyan-100/60 shadow-[0_0_16px_rgba(34,211,238,0.65)]",
        homeFillClass: "bg-teal-400/50",
        awayFillClass: "bg-cyan-400/50",
        homeTrackClass: "bg-teal-950/60 ring-1 ring-teal-400/25",
        awayTrackClass: "bg-cyan-950/60 ring-1 ring-cyan-400/25",
        meanTextClass: "text-teal-100",
        tabActiveClass: "bg-teal-400/20 text-teal-50 ring-1 ring-teal-300/35"
      };
    case "possession":
      return {
        titleClass: "text-emerald-200",
        cardBorderClass: "border-emerald-400/30",
        cardBgClass: "bg-emerald-500/[0.08]",
        homeDotClass: "bg-emerald-300 ring-emerald-100/60 shadow-[0_0_16px_rgba(52,211,153,0.65)]",
        awayDotClass: "bg-lime-300 ring-lime-100/60 shadow-[0_0_16px_rgba(163,230,53,0.65)]",
        homeFillClass: "bg-emerald-400/50",
        awayFillClass: "bg-lime-400/50",
        homeTrackClass: "bg-emerald-950/60 ring-1 ring-emerald-400/25",
        awayTrackClass: "bg-lime-950/60 ring-1 ring-lime-400/25",
        meanTextClass: "text-emerald-100",
        tabActiveClass: "bg-emerald-400/20 text-emerald-50 ring-1 ring-emerald-300/35"
      };
    case "fouls":
      return {
        titleClass: "text-orange-200",
        cardBorderClass: "border-orange-400/30",
        cardBgClass: "bg-orange-500/[0.08]",
        homeDotClass: "bg-orange-300 ring-orange-100/60 shadow-[0_0_16px_rgba(251,146,60,0.65)]",
        awayDotClass: "bg-red-300 ring-red-100/60 shadow-[0_0_16px_rgba(252,165,165,0.65)]",
        homeFillClass: "bg-orange-400/50",
        awayFillClass: "bg-red-400/50",
        homeTrackClass: "bg-orange-950/60 ring-1 ring-orange-400/25",
        awayTrackClass: "bg-red-950/60 ring-1 ring-red-400/25",
        meanTextClass: "text-orange-100",
        tabActiveClass: "bg-orange-400/20 text-orange-50 ring-1 ring-orange-300/35"
      };
    case "yellowCards":
      return {
        titleClass: "text-yellow-200",
        cardBorderClass: "border-yellow-400/30",
        cardBgClass: "bg-yellow-500/[0.08]",
        homeDotClass: "bg-yellow-300 ring-yellow-100/60 shadow-[0_0_16px_rgba(250,204,21,0.65)]",
        awayDotClass: "bg-amber-300 ring-amber-100/60 shadow-[0_0_16px_rgba(251,191,36,0.65)]",
        homeFillClass: "bg-yellow-400/55",
        awayFillClass: "bg-amber-400/55",
        homeTrackClass: "bg-yellow-950/60 ring-1 ring-yellow-400/25",
        awayTrackClass: "bg-amber-950/60 ring-1 ring-amber-400/25",
        meanTextClass: "text-yellow-100",
        tabActiveClass: "bg-yellow-400/20 text-yellow-50 ring-1 ring-yellow-300/35"
      };
    default:
      return DEFAULT_THEME;
  }
}

interface SimulationMeanRangeBarProps {
  summary: DistributionSummary;
  metricKey: string;
  theme?: MetricVisualTheme;
  side?: "home" | "away";
  size?: "default" | "large";
}

export function SimulationMeanRangeBar({
  summary,
  metricKey,
  theme = DEFAULT_THEME,
  side = "home",
  size = "large"
}: SimulationMeanRangeBarProps) {
  const min = summary.min;
  const max = summary.max;
  const span = Math.max(max - min, 0.0001);
  const position = Math.min(100, Math.max(0, ((summary.mean - min) / span) * 100));
  const isHome = side === "home";
  const trackClass = isHome ? theme.homeTrackClass : theme.awayTrackClass;
  const fillClass = isHome ? theme.homeFillClass : theme.awayFillClass;
  const dotClass = isHome ? theme.homeDotClass : theme.awayDotClass;
  const meanFormatted = formatExpected(summary.mean, metricKey);
  const trackHeight = size === "large" ? "h-3.5" : "h-2";
  const dotSize = size === "large" ? "h-6 w-6 ring-[3px]" : "h-4 w-4 ring-2";

  return (
    <div className={size === "large" ? "mt-3 space-y-3" : "mt-2 space-y-2"}>
      <div className={`relative rounded-full ${trackHeight} ${trackClass}`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`}
          style={{ width: `${position}%` }}
        />
        <div
          className={`absolute top-1/2 ${dotSize} -translate-x-1/2 -translate-y-1/2 rounded-full ${dotClass}`}
          style={{ left: `${position}%` }}
          title={`Media ${meanFormatted}`}
        />
      </div>
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 whitespace-nowrap ${
          size === "large" ? "text-[11px] sm:text-xs" : "text-[10px]"
        } text-slate-400`}
      >
        <span className="min-w-0 truncate text-left tabular-nums">
          Min. <span className="font-medium text-slate-300">{formatExpected(min, metricKey)}</span>
        </span>
        <span
          className={`shrink-0 px-1 text-center font-bold tabular-nums leading-none ${
            size === "large" ? "text-base sm:text-lg" : "text-sm"
          } ${theme.meanTextClass}`}
        >
          {meanFormatted}
        </span>
        <span className="min-w-0 truncate text-right tabular-nums">
          Max. <span className="font-medium text-slate-300">{formatExpected(max, metricKey)}</span>
        </span>
      </div>
      {size === "large" ? (
        <p className={`text-center text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.meanTextClass}`}>
          Media simulata
        </p>
      ) : null}
    </div>
  );
}

interface MiniHistogramProps {
  summary: DistributionSummary;
  colorClass?: string;
}

export function MiniHistogram({ summary, colorClass = "bg-cyan-400/70" }: MiniHistogramProps) {
  const max = Math.max(...summary.histogram.map((b) => b.probability), 0.01);
  return (
    <div className="flex h-12 items-end gap-1">
      {summary.histogram.slice(0, 12).map((bucket) => (
        <div
          key={bucket.bucket}
          className={`flex-1 rounded-sm ${colorClass}`}
          style={{ height: `${Math.max(8, (bucket.probability / max) * 100)}%` }}
          title={`${bucket.bucket}: ${Math.round(bucket.probability * 100)}%`}
        />
      ))}
    </div>
  );
}

interface MetricHistogramProps {
  summary: DistributionSummary;
  metricKey?: string;
  theme?: MetricVisualTheme;
  side?: "home" | "away";
}

export function MetricHistogramPanel({
  summary,
  metricKey = "default",
  theme,
  side = "home"
}: MetricHistogramProps) {
  const resolvedTheme = theme ?? getMetricVisualTheme(metricKey);
  const borderClass = side === "home" ? resolvedTheme.cardBorderClass : resolvedTheme.cardBorderClass;
  const bgClass = side === "home" ? resolvedTheme.cardBgClass : resolvedTheme.cardBgClass;

  return (
    <div className={`rounded-2xl border p-5 ${borderClass} ${bgClass}`}>
      <SimulationMeanRangeBar
        summary={summary}
        metricKey={metricKey}
        theme={resolvedTheme}
        side={side}
        size="large"
      />
    </div>
  );
}
