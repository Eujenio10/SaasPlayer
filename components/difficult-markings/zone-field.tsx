"use client";

import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import { overlapHighlightPctFromPayload } from "@/components/foul-committed-risk/mini-duel-heatmap";
import { resolveMarkingDuelHeatmapPayload } from "@/lib/difficult-markings/marking-duel-heatmap";
import {
  resolveEstimatedClashOverlapGrid
} from "@/lib/difficult-markings/marking-zone-fallback";
import { GRID_COLUMNS, GRID_ROWS } from "@/lib/difficult-markings/heatmap";
import type { ProbableZone } from "@/lib/difficult-markings/types";
import { zoneLabelIt } from "@/lib/difficult-markings/scoring";

function EstimatedClashZoneGrid({
  overlapGrid,
  compact
}: {
  overlapGrid: number[];
  compact?: boolean;
}) {
  let peak = 0;
  for (const value of overlapGrid) {
    if (value > peak) peak = value;
  }

  const inset = compact ? "inset-2" : "inset-3";
  const pitchPad = compact ? "p-2" : "p-3";

  return (
    <div
      className={`relative overflow-hidden border border-emerald-400/20 bg-gradient-to-b from-emerald-950/40 via-emerald-900/20 to-emerald-950/50 shadow-inner ${
        compact ? "aspect-[5/3] max-w-[220px] rounded-xl" : "aspect-[5/3] rounded-2xl"
      } ${pitchPad}`}
    >
      <div className={`absolute ${inset} rounded-xl border border-white/10`} />
      <div className={`absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-white/10 ${compact ? "" : "top-3 bottom-3"}`} />
      <div
        className={`absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 ${
          compact ? "h-10" : "left-3 right-3 h-16"
        }`}
      />
      <div
        className={`absolute ${inset} grid gap-0.5`}
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`
        }}
      >
        {overlapGrid.map((value, idx) => {
          const norm = peak > 0 ? value / peak : 0;
          const alpha = value <= 0.0001 ? 0 : Math.min(0.92, 0.25 + Math.pow(norm, 0.75) * 0.65);
          return (
            <div
              key={idx}
              className="rounded-[2px]"
              style={{ backgroundColor: `rgba(244,63,94,${alpha})` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DifficultMarkingZoneField({
  overlapGrid,
  attackerRole,
  defenderRole,
  defenderPlayerName,
  attackerPlayerName,
  probableZone,
  overlapPct,
  estimatedZoneOnly,
  compact = false,
  visualization
}: {
  overlapGrid?: number[];
  attackerGrid?: number[];
  defenderGrid?: number[];
  attackerRole?: string;
  defenderRole?: string;
  defenderPlayerName?: string;
  attackerPlayerName?: string;
  probableZone: ProbableZone;
  overlapPct: number;
  estimatedZoneOnly: boolean;
  usedHeatmap?: boolean;
  mode?: "overlap" | "attacker" | "defender" | "clash";
  compact?: boolean;
  visualization?: {
    attackerHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    defenderHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    attackerClubColor?: string;
    defenderClubColor?: string;
    overlapGrid?: number[];
  };
}) {
  const payload = resolveMarkingDuelHeatmapPayload({
    defenderPlayerName: defenderPlayerName ?? "Marcatore",
    attackerPlayerName: attackerPlayerName ?? "Attaccante",
    visualization
  });

  const metaRow = (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? "text-[11px]" : "text-sm"}`}>
      <span className="font-medium text-white">{zoneLabelIt(probableZone)}</span>
      <span className="text-slate-300">Sovrapposizione {overlapPct}%</span>
    </div>
  );

  if (payload) {
    const highlight = overlapHighlightPctFromPayload(payload);
    return (
      <div className={compact ? "space-y-1.5" : "space-y-3"}>
        <div className={compact ? "max-w-[200px]" : "max-w-[280px]"}>
          <FrictionPitchHeatmap {...payload} compact={compact} highlightCirclePct={highlight} className="!space-y-1" />
        </div>
        {metaRow}
      </div>
    );
  }

  const estimatedGrid = resolveEstimatedClashOverlapGrid({
    probableZone,
    attackerRole: attackerRole ?? "UNKNOWN",
    defenderRole: defenderRole ?? "UNKNOWN",
    overlapGrid: overlapGrid ?? visualization?.overlapGrid
  });

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <EstimatedClashZoneGrid overlapGrid={estimatedGrid} compact={compact} />
      <p className="text-[11px] text-rose-300/90">Zona di scontro stimata</p>
      {metaRow}
      <p className="text-xs text-amber-200/90">
        {estimatedZoneOnly
          ? "Heatmap storica non disponibile: posizione stimata da ruoli e zona tattica."
          : "Heatmap storica non disponibile per questo duello."}
      </p>
    </div>
  );
}
