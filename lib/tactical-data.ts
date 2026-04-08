import { cache } from "react";
import type { TacticalMetrics } from "@/lib/types";
import { getOrRefreshSnapshot } from "@/lib/tactical-snapshots";

export interface TacticalDataResult {
  fixtureId: string;
  metrics: TacticalMetrics[];
  updatedAt: string | null;
  sourceStatus: string;
}

function defaultFixtureId() {
  return process.env.TACTICAL_DEFAULT_FIXTURE_ID ?? "auto-live";
}

export const getCachedTacticalSnapshot = cache(
  async (organizationId: string): Promise<TacticalDataResult> => {
    const fixtureId = defaultFixtureId();
    const snapshot = await getOrRefreshSnapshot({ organizationId, fixtureId });

    return {
      fixtureId,
      metrics: snapshot?.metrics ?? [],
      updatedAt: snapshot?.updated_at ?? null,
      sourceStatus: snapshot?.source_status ?? "error"
    };
  }
);
