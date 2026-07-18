"use client";

import type { TeamPerformanceOverview } from "@/lib/player-performance/advanced-types";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";
import {
  formatIndex,
  formatTrendPercent,
  PLAYER_PERFORMANCE_TEXT
} from "@/lib/player-performance/text";

function OverviewRow({
  label,
  player,
  valueLabel,
  value,
  onSelect
}: {
  label: string;
  player: PlayerPerformanceItem | null;
  valueLabel: string;
  value: string;
  onSelect: (item: PlayerPerformanceItem) => void;
}) {
  if (!player) return null;
  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{player.playerName}</p>
      <p className="text-xs text-cyan-200">
        {valueLabel}: {value}
      </p>
    </button>
  );
}

export function TeamOverviewSummary({
  teamName,
  overview,
  onSelectPlayer
}: {
  teamName: string;
  overview: TeamPerformanceOverview;
  onSelectPlayer: (item: PlayerPerformanceItem) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold uppercase tracking-wide text-cyan-200">{teamName}</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        <OverviewRow
          label={PLAYER_PERFORMANCE_TEXT.overview.mostDangerous}
          player={overview.mostDangerous}
          valueLabel={PLAYER_PERFORMANCE_TEXT.indices.dangerIndex}
          value={formatIndex(overview.mostDangerous?.dangerIndex)}
          onSelect={onSelectPlayer}
        />
        <OverviewRow
          label={PLAYER_PERFORMANCE_TEXT.overview.bestOffensiveForm}
          player={overview.bestOffensiveForm}
          valueLabel={PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend}
          value={formatTrendPercent(overview.bestOffensiveForm?.offensiveTrend ?? null)}
          onSelect={onSelectPlayer}
        />
        <OverviewRow
          label={PLAYER_PERFORMANCE_TEXT.overview.biggestDecline}
          player={overview.biggestDecline}
          valueLabel={PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend}
          value={formatTrendPercent(overview.biggestDecline?.offensiveTrend ?? null)}
          onSelect={onSelectPlayer}
        />
        <OverviewRow
          label={PLAYER_PERFORMANCE_TEXT.overview.bestCreator}
          player={overview.bestCreator}
          valueLabel={PLAYER_PERFORMANCE_TEXT.indices.creatorIndex}
          value={formatIndex(overview.bestCreator?.creation?.creatorIndex ?? null)}
          onSelect={onSelectPlayer}
        />
        <OverviewRow
          label={PLAYER_PERFORMANCE_TEXT.overview.mostConsistent}
          player={overview.mostConsistent}
          valueLabel={PLAYER_PERFORMANCE_TEXT.indices.consistencyScore}
          value={formatIndex(overview.mostConsistent?.consistency?.score ?? null)}
          onSelect={onSelectPlayer}
        />
      </div>
    </div>
  );
}
