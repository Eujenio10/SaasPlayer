import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { buildMatchPlayerPerformance } from "@/lib/player-performance/build";
import { isPlayerPerformanceAnchorStillUpcoming } from "@/lib/player-performance/fixture-eligibility";
import type { MatchPlayerPerformance } from "@/lib/player-performance/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

let cachedTablesAvailable: boolean | undefined;
let cachedTablesAt = 0;
const TABLES_TTL_MS = 60_000;

function isMissingTableError(message: string): boolean {
  return message.includes("Could not find the table") || message.includes("does not exist");
}

export async function arePlayerPerformanceSnapshotTablesAvailable(): Promise<boolean> {
  const now = Date.now();
  if (cachedTablesAvailable !== undefined && now - cachedTablesAt < TABLES_TTL_MS) {
    return cachedTablesAvailable;
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb
    .from("organization_player_performance_snapshot")
    .select("event_id")
    .limit(1);

  if (!error) cachedTablesAvailable = true;
  else if (isMissingTableError(error.message)) cachedTablesAvailable = false;
  else {
    cachedTablesAvailable = false;
    console.warn("[player-performance] snapshot_tables_probe_failed", { message: error.message });
  }
  cachedTablesAt = now;
  return cachedTablesAvailable;
}

export async function loadPlayerPerformanceSnapshot(params: {
  organizationId: string;
  eventId: number;
}): Promise<MatchPlayerPerformance | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_player_performance_snapshot")
    .select("payload,updated_at")
    .eq("organization_id", params.organizationId.trim())
    .eq("event_id", params.eventId)
    .maybeSingle();

  if (error || !data?.payload) {
    if (error) {
      console.warn("[player-performance] snapshot_read_failed", {
        organizationId: params.organizationId,
        eventId: params.eventId,
        message: error.message
      });
    }
    return null;
  }

  return data.payload as MatchPlayerPerformance;
}

export async function upsertPlayerPerformanceSnapshot(params: {
  organizationId: string;
  eventId: number;
  insightsSnap: number;
  payload: MatchPlayerPerformance;
}): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("organization_player_performance_snapshot").upsert(
    {
      organization_id: params.organizationId.trim(),
      event_id: params.eventId,
      insights_snap: params.insightsSnap,
      payload: params.payload as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id,event_id" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function purgeOrganizationPlayerPerformanceSnapshots(
  organizationId: string
): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb
    .from("organization_player_performance_snapshot")
    .delete()
    .eq("organization_id", organizationId.trim());
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function prunePlayerPerformanceSnapshotsOutsideEventIds(
  organizationId: string,
  keepEventIds: number[]
): Promise<{ ok: boolean; message?: string }> {
  const keep = new Set(keepEventIds.filter((id) => id > 0));
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_player_performance_snapshot")
    .select("event_id")
    .eq("organization_id", organizationId.trim());

  if (error) return { ok: false, message: error.message };

  const stale = (data ?? [])
    .map((row) => (typeof row.event_id === "number" ? row.event_id : Number(row.event_id)))
    .filter((eventId) => eventId > 0 && !keep.has(eventId));

  if (!stale.length) return { ok: true };

  const chunkSize = 80;
  for (let i = 0; i < stale.length; i += chunkSize) {
    const slice = stale.slice(i, i + chunkSize);
    const { error: deleteError } = await sb
      .from("organization_player_performance_snapshot")
      .delete()
      .eq("organization_id", organizationId.trim())
      .in("event_id", slice);
    if (deleteError) return { ok: false, message: deleteError.message };
  }

  return { ok: true };
}

/** Precomputa Player Performance per tutte le partite del menu (solo refresh giornaliero/admin). */
export async function regeneratePlayerPerformanceSnapshotsForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
  insightsSnap: number;
  maxMatches?: number;
  /** Se impostato, interrompe il ciclo oltre questo tempo (anti-timeout su serverless a fasi). */
  maxDurationMs?: number;
}): Promise<{ ok: boolean; saved: number; failed: number; message?: string }> {
  if (!(await arePlayerPerformanceSnapshotTablesAvailable())) {
    return { ok: false, saved: 0, failed: 0, message: "player_performance_tables_missing" };
  }

  const upcoming = params.matches.filter((match) =>
    isPlayerPerformanceAnchorStillUpcoming({
      fixtureId: match.eventId,
      kickoffTimestamp: match.startTimestamp
    })
  );
  /** Senza limite esplicito, un refresh su tutte le competizioni rischierebbe di girare
   * all'infinito e far scadere il timeout serverless prima di trend/marcature. */
  const limit = params.maxMatches ?? Math.min(upcoming.length, 40);
  const targets = upcoming.slice(0, limit);

  await prunePlayerPerformanceSnapshotsOutsideEventIds(
    params.organizationId,
    upcoming.map((match) => match.eventId)
  );

  const startedAt = Date.now();
  let saved = 0;
  let failed = 0;
  let skippedByBudget = 0;

  for (const match of targets) {
    if (params.maxDurationMs != null && Date.now() - startedAt > params.maxDurationMs) {
      skippedByBudget = targets.length - saved - failed;
      console.warn("[player-performance] regenerate_time_budget_exhausted", {
        organizationId: params.organizationId,
        processed: saved + failed,
        remaining: skippedByBudget
      });
      break;
    }
    try {
      const payload = await buildMatchPlayerPerformance(match.eventId, {
        homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
        awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
        startTimestamp: match.startTimestamp
      });
      if (!payload) {
        failed += 1;
        continue;
      }
      const persist = await upsertPlayerPerformanceSnapshot({
        organizationId: params.organizationId,
        eventId: match.eventId,
        insightsSnap: params.insightsSnap,
        payload
      });
      if (persist.ok) saved += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.warn("[player-performance] regenerate_match_failed", {
        eventId: match.eventId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.info("[player-performance] regenerate_complete", {
    organizationId: params.organizationId,
    targets: targets.length,
    saved,
    failed,
    skippedByBudget
  });

  return { ok: true, saved, failed };
}
