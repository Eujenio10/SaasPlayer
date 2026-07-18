import { MATCH_RADAR_CONFIG, modeSortKey, type MatchRadarMode } from "@/lib/match-radar/config";
import { kickoffToRomeDateKey } from "@/lib/match-radar/date";
import type { MatchRadarComputed } from "@/lib/match-radar/types";

export function sortMatchRadarRows(
  rows: MatchRadarComputed[],
  mode: MatchRadarMode
): MatchRadarComputed[] {
  const key = modeSortKey(mode);

  return [...rows].sort((a, b) => {
    const confidencePenalty = (row: MatchRadarComputed) =>
      row.confidenceLevel === "low" ? MATCH_RADAR_CONFIG.lowConfidenceSortPenalty : 0;

    if (key === "radarScore") {
      return b.radarScore - a.radarScore - confidencePenalty(a) + confidencePenalty(b);
    }

    const dimensionKey =
      key === "intensity"
        ? "intensity"
        : key === "attackingPotential"
          ? "attackingPotential"
          : key === "balance"
            ? "balance"
            : "volatility";

    const aVal = a.dimensions[dimensionKey] ?? -1;
    const bVal = b.dimensions[dimensionKey] ?? -1;
    if (bVal !== aVal) return bVal - aVal;
    return b.radarScore - a.radarScore;
  });
}

export function filterMatchRadarByRomeDate(
  rows: MatchRadarComputed[],
  dateKey: string
): MatchRadarComputed[] {
  return rows.filter((row) => kickoffToRomeDateKey(row.kickoffAt) === dateKey);
}

export function romeDateRangeUtc(dateKey: string): { from: string; to: string } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endLocal = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const offsetGuessMs = 60 * 60 * 1000;
  return {
    from: new Date(startLocal.getTime() - offsetGuessMs).toISOString(),
    to: new Date(endLocal.getTime() + offsetGuessMs).toISOString()
  };
}
