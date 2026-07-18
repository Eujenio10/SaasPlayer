import { upsertOrganizationDifficultMarkingsSnapshot } from "@/lib/difficult-markings/snapshot";
import { countStoredMarkupsInSnapshot } from "@/lib/difficult-markings/query";
import type { DifficultMarkingsSnapshot } from "@/lib/difficult-markings/types";
import { upsertOrganizationTrendsSnapshot } from "@/lib/trends/snapshot";
import type { TrendsSnapshot } from "@/lib/trends/types";

function countTrends(snapshot: TrendsSnapshot | null | undefined): number {
  return Object.keys(snapshot?.trendIndex ?? {}).length;
}

/** Scrive su Supabase lo snapshot già filtrato (partite passate rimosse). */
export async function persistPrunedTrendsSnapshotIfChanged(params: {
  organizationId: string;
  raw: TrendsSnapshot;
  pruned: TrendsSnapshot;
}): Promise<void> {
  if (countTrends(params.raw) === countTrends(params.pruned)) return;

  const result = await upsertOrganizationTrendsSnapshot({
    organizationId: params.organizationId,
    insightsSnap: params.pruned.insightsSnap,
    snapshot: {
      ...params.pruned,
      updatedAt: new Date().toISOString()
    },
    forceReplace: true
  });

  if (!result.ok) {
    console.warn("[catalog-sync] trends_prune_persist_failed", {
      organizationId: params.organizationId,
      message: result.message
    });
  } else {
    console.info("[catalog-sync] trends_prune_persisted", {
      organizationId: params.organizationId,
      before: countTrends(params.raw),
      after: countTrends(params.pruned)
    });
  }
}

export async function persistPrunedMarkingsSnapshotIfChanged(params: {
  organizationId: string;
  raw: DifficultMarkingsSnapshot;
  pruned: DifficultMarkingsSnapshot;
}): Promise<void> {
  const before = countStoredMarkupsInSnapshot(params.raw);
  const after = countStoredMarkupsInSnapshot(params.pruned);
  if (before === after) return;

  const result = await upsertOrganizationDifficultMarkingsSnapshot({
    organizationId: params.organizationId,
    insightsSnap: params.pruned.insightsSnap,
    snapshot: {
      ...params.pruned,
      updatedAt: new Date().toISOString()
    },
    forceReplace: true
  });

  if (!result.ok) {
    console.warn("[catalog-sync] markings_prune_persist_failed", {
      organizationId: params.organizationId,
      message: result.message
    });
  } else {
    console.info("[catalog-sync] markings_prune_persisted", {
      organizationId: params.organizationId,
      before,
      after
    });
  }
}
