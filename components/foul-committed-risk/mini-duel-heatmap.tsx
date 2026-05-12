"use client";

import { frictionHeatmapIsTrustedForUi } from "@/lib/friction-heatmap-validation";
import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import type { SparkFrictionHeatmapPayload, TacticalMetrics } from "@/lib/types";

function duelMatchesSparkPair(player: TacticalMetrics, agg: TacticalMetrics): boolean {
  const d = player.sparkDuel;
  if (!d) return false;
  const idHit =
    typeof agg.playerId === "number" &&
    agg.playerId > 0 &&
    typeof d.playerBId === "number" &&
    d.playerBId === agg.playerId;
  const nameHit =
    d.playerB.replace(/\s+/g, " ").trim().toUpperCase() ===
    agg.playerName.replace(/\s+/g, " ").trim().toUpperCase();
  return idHit || nameHit;
}

function payloadFromMatchFrames(a: TacticalMetrics, b: TacticalMetrics): SparkFrictionHeatmapPayload | null {
  const pa = a.heatmapPointsMatchFrame;
  const pb = b.heatmapPointsMatchFrame;
  if (!pa?.length || !pb?.length) return null;
  const payload: SparkFrictionHeatmapPayload = {
    labelA: a.playerName,
    labelB: b.playerName,
    clubColorA: a.clubColor || "#8b5cf6",
    clubColorB: b.clubColor || "#c084fc",
    pointsA: pa,
    pointsB: pb
  };
  return frictionHeatmapIsTrustedForUi(payload, {
    positionCodeA: a.positionCode,
    positionCodeB: b.positionCode
  })
    ? payload
    : null;
}

export function resolveCommittedRowHeatmapPayload(
  player: TacticalMetrics | undefined,
  aggressor: TacticalMetrics | undefined
): SparkFrictionHeatmapPayload | null {
  if (!player || !aggressor) return null;
  if (
    player.sparkFrictionHeatmap &&
    duelMatchesSparkPair(player, aggressor) &&
    frictionHeatmapIsTrustedForUi(player.sparkFrictionHeatmap, {
      positionCodeA: player.positionCode,
      positionCodeB: aggressor.positionCode
    })
  ) {
    return player.sparkFrictionHeatmap;
  }
  return payloadFromMatchFrames(player, aggressor);
}

/** Centroid e raggio in percentuali campo 0–100 per cerchio tratteggiato (solo overlay visivo). */
export function overlapHighlightPctFromPayload(hm: SparkFrictionHeatmapPayload): { cx: number; cy: number; r: number } {
  const pts = [...hm.pointsA, ...hm.pointsB];
  if (pts.length === 0) return { cx: 50, cy: 50, r: 14 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += Math.max(0, Math.min(100, p.x));
    sy += Math.max(0, Math.min(100, p.y));
  }
  const cx = sx / pts.length;
  const cy = sy / pts.length;
  let maxd = 8;
  for (const p of pts) {
    const x = Math.max(0, Math.min(100, p.x));
    const y = Math.max(0, Math.min(100, p.y));
    const d = Math.hypot(x - cx, y - cy);
    if (d > maxd) maxd = d;
  }
  const r = Math.min(22, Math.max(10, maxd + 6));
  return { cx, cy, r };
}

export function MiniDuelHeatmap({
  playerMetric,
  aggressorMetric
}: {
  playerMetric: TacticalMetrics | undefined;
  aggressorMetric: TacticalMetrics | undefined;
}) {
  const hm = resolveCommittedRowHeatmapPayload(playerMetric, aggressorMetric);
  if (!hm) {
    return (
      <div
        className="flex aspect-[105/68] max-h-[120px] w-full max-w-[200px] items-center justify-center rounded-2xl border border-dashed border-[rgba(120,170,255,0.2)] bg-[rgba(8,16,32,0.92)] px-3 text-center text-[11px] text-slate-500"
        role="img"
        aria-label="Heatmap duello non disponibile per questo abbinamento"
      >
        Zona di confronto non disponibile (heatmap insufficienti o abbinamento diverso dal duello spark).
      </div>
    );
  }

  const highlight = overlapHighlightPctFromPayload(hm);

  return (
    <div className="relative w-full max-w-[210px]" role="img" aria-label="Zona di maggior confronto sul campo">
      <FrictionPitchHeatmap {...hm} compact highlightCirclePct={highlight} className="!space-y-1" />
    </div>
  );
}
