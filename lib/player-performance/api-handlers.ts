import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import { buildMatchPlayerPerformance } from "@/lib/player-performance/build";
import { PlayerPerformanceMatchStartedError } from "@/lib/player-performance/fixture-eligibility";
import {
  arePlayerPerformanceSnapshotTablesAvailable,
  loadPlayerPerformanceSnapshot,
  upsertPlayerPerformanceSnapshot
} from "@/lib/player-performance/snapshot";
import type { MatchPlayerPerformance } from "@/lib/player-performance/types";

const ON_DEMAND_INGESTION_BUDGET_MS = 25_000;

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

/**
 * Se lo snapshot manca (es. refresh admin non ha salvato PP), calcola e persiste on-demand.
 * Usato da Pro/admin/sblocco partita all’apertura del tab.
 */
export async function getOrComputeMatchPlayerPerformance(params: {
  eventId: number;
  organizationId: string;
  allowCompute: boolean;
  hints?: {
    homeTeamId?: number;
    awayTeamId?: number;
    homeTeamName?: string;
    awayTeamName?: string;
    startTimestamp?: number;
  };
}): Promise<{
  payload: MatchPlayerPerformance | null;
  status:
    | "ok"
    | "not_found"
    | "tables_missing"
    | "org_unavailable"
    | "compute_failed"
    | "match_started";
}> {
  const stored = await getStoredMatchPlayerPerformance(params.eventId, params.organizationId);
  if (stored.payload) return stored;
  if (!params.allowCompute) return stored;

  try {
    const match = await findOrganizationMatchByEventId(params.organizationId, params.eventId);
    const homeTeam = match
      ? { id: match.homeTeam.id, name: match.homeTeam.name }
      : params.hints?.homeTeamId
        ? {
            id: params.hints.homeTeamId,
            name: params.hints.homeTeamName ?? "Home"
          }
        : undefined;
    const awayTeam = match
      ? { id: match.awayTeam.id, name: match.awayTeam.name }
      : params.hints?.awayTeamId
        ? {
            id: params.hints.awayTeamId,
            name: params.hints.awayTeamName ?? "Away"
          }
        : undefined;
    if (!homeTeam || !awayTeam) {
      return { payload: null, status: "compute_failed" };
    }

    const payload = await buildMatchPlayerPerformance(
      params.eventId,
      {
        homeTeam,
        awayTeam,
        startTimestamp: match?.startTimestamp ?? params.hints?.startTimestamp
      },
      { ingestionBudgetMs: ON_DEMAND_INGESTION_BUDGET_MS }
    );
    if (!payload) {
      return { payload: null, status: "compute_failed" };
    }

    if (stored.status !== "tables_missing") {
      await upsertPlayerPerformanceSnapshot({
        organizationId: params.organizationId,
        eventId: params.eventId,
        insightsSnap: Math.floor(Date.now() / 1000),
        payload
      });
    }

    return { payload, status: "ok" };
  } catch (error) {
    if (error instanceof PlayerPerformanceMatchStartedError) {
      return { payload: null, status: "match_started" };
    }
    console.warn(
      "[player-performance] on_demand_compute_failed",
      params.eventId,
      error instanceof Error ? error.message : String(error)
    );
    return { payload: null, status: "compute_failed" };
  }
}
