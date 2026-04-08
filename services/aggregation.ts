import { buildTacticalMetrics } from "@/lib/predictive";
import type { TacticalMetrics } from "@/lib/types";
import { fetchSportPerformance } from "@/services/sportapi";

export interface TacticalSnapshotBundle {
  metrics: TacticalMetrics[];
}

export async function getTacticalSnapshotBundle(
  fixtureId: string
): Promise<TacticalSnapshotBundle> {
  const performance = await fetchSportPerformance(fixtureId);

  const metrics = performance.map((athlete) => buildTacticalMetrics(athlete, performance));

  return {
    metrics
  };
}

export async function getTacticalSnapshot(
  fixtureId: string
): Promise<TacticalMetrics[]> {
  const bundle = await getTacticalSnapshotBundle(fixtureId);
  return bundle.metrics;
}
