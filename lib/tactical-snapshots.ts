import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getTacticalSnapshotBundle } from "@/services/aggregation";
import type { TacticalMetrics, TacticalSnapshotRow } from "@/lib/types";

function defaultFixtureId(): string {
  return process.env.TACTICAL_DEFAULT_FIXTURE_ID ?? "auto-live";
}

function isAutoFixture(fixtureId: string): boolean {
  return !/^[0-9]+$/.test(fixtureId);
}

function maxAgeSeconds(): number {
  /** Default 5 giorni: evita ricalcoli SportAPI ad ogni apertura /display o snapshot. */
  const raw = Number(process.env.TACTICAL_SNAPSHOT_MAX_AGE_SECONDS ?? "432000");
  if (!Number.isFinite(raw) || raw <= 0) return 432000;
  return Math.floor(raw);
}

export async function getLatestSnapshot(
  organizationId: string,
  fixtureId = defaultFixtureId()
): Promise<TacticalSnapshotRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("tactical_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("fixture_id", fixtureId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as TacticalSnapshotRow;
}

export async function upsertSnapshot(params: {
  organizationId: string;
  fixtureId?: string;
  metrics: TacticalMetrics[];
  sourceStatus?: string;
}): Promise<TacticalSnapshotRow | null> {
  const supabase = createSupabaseServiceClient();
  const fixtureId = params.fixtureId ?? defaultFixtureId();

  const payload = {
    organization_id: params.organizationId,
    fixture_id: fixtureId,
    metrics: params.metrics,
    source_status: params.sourceStatus ?? "ok",
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("tactical_snapshots")
    .upsert(payload, { onConflict: "organization_id,fixture_id" })
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as TacticalSnapshotRow;
}

export async function refreshSnapshot(params: {
  organizationId: string;
  fixtureId?: string;
}): Promise<TacticalSnapshotRow | null> {
  const fixtureId = params.fixtureId ?? defaultFixtureId();
  try {
    const bundle = await getTacticalSnapshotBundle(fixtureId);
    return await upsertSnapshot({
      organizationId: params.organizationId,
      fixtureId,
      metrics: bundle.metrics,
      sourceStatus: "ok"
    });
  } catch {
    if (isAutoFixture(fixtureId)) {
      return await upsertSnapshot({
        organizationId: params.organizationId,
        fixtureId,
        metrics: [],
        sourceStatus: "error"
      });
    }

    const fallback = await getLatestSnapshot(params.organizationId, fixtureId);
    if (fallback) {
      return await upsertSnapshot({
        organizationId: params.organizationId,
        fixtureId,
        metrics: fallback.metrics,
        sourceStatus: "stale"
      });
    }
    return await upsertSnapshot({
      organizationId: params.organizationId,
      fixtureId,
      metrics: [],
      sourceStatus: "error"
    });
  }
}

export async function getOrRefreshSnapshot(params: {
  organizationId: string;
  fixtureId?: string;
  forceRefresh?: boolean;
}): Promise<TacticalSnapshotRow | null> {
  const fixtureId = params.fixtureId ?? defaultFixtureId();
  const latest = await getLatestSnapshot(params.organizationId, fixtureId);

  if (params.forceRefresh || !latest) {
    return refreshSnapshot({ organizationId: params.organizationId, fixtureId });
  }

  const ageMs = Date.now() - new Date(latest.updated_at).getTime();
  if (ageMs > maxAgeSeconds() * 1000) {
    return refreshSnapshot({ organizationId: params.organizationId, fixtureId });
  }

  return latest;
}
