import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import {
  arePlayerPerformanceSnapshotTablesAvailable,
  loadPlayerPerformanceSnapshot
} from "@/lib/player-performance/snapshot";
import type { MatchPlayerPerformance } from "@/lib/player-performance/types";

export async function getStoredMatchPlayerPerformance(
  eventId: number,
  organizationId?: string
): Promise<{
  payload: MatchPlayerPerformance | null;
  status: "ok" | "not_found" | "tables_missing" | "org_unavailable";
}> {
  if (!(await arePlayerPerformanceSnapshotTablesAvailable())) {
    return { payload: null, status: "tables_missing" };
  }

  const orgId = organizationId?.trim() || (await resolveProductOrganizationId());
  if (!orgId) {
    return { payload: null, status: "org_unavailable" };
  }

  const payload = await loadPlayerPerformanceSnapshot({
    organizationId: orgId,
    eventId
  });

  return {
    payload,
    status: payload ? "ok" : "not_found"
  };
}
