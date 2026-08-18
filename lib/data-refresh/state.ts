import type { DataRefreshTrigger } from "@/lib/data-refresh/config";
import {
  parseMorningRefreshJob,
  type MorningRefreshJob
} from "@/lib/data-refresh/morning-job";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

interface RefreshStateRow {
  last_refresh_at: string | null;
  last_refresh_trigger: DataRefreshTrigger | null;
  last_refresh_ok: boolean | null;
  morning_job: unknown;
}

async function loadRefreshStateRow(organizationId: string): Promise<RefreshStateRow | null> {
  const supabase = createSupabaseServiceClient();
  const withJob = await supabase
    .from("organization_data_refresh_state")
    .select("last_refresh_at, last_refresh_trigger, last_refresh_ok, morning_job")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!withJob.error) {
    return (withJob.data as RefreshStateRow | null) ?? null;
  }

  const message = withJob.error.message.toLowerCase();
  if (!message.includes("morning_job") && !message.includes("column")) {
    console.warn("[data-refresh] load_state_failed:", withJob.error.message);
    return null;
  }

  const fallback = await supabase
    .from("organization_data_refresh_state")
    .select("last_refresh_at, last_refresh_trigger, last_refresh_ok")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fallback.error) {
    console.warn("[data-refresh] load_state_failed:", fallback.error.message);
    return null;
  }

  return fallback.data
    ? {
        last_refresh_at: fallback.data.last_refresh_at,
        last_refresh_trigger: fallback.data.last_refresh_trigger,
        last_refresh_ok: fallback.data.last_refresh_ok,
        morning_job: null
      }
    : null;
}

export async function getLastDataRefreshAt(organizationId: string): Promise<string | null> {
  const stateRow = await loadRefreshStateRow(organizationId);
  if (stateRow?.last_refresh_at) {
    return stateRow.last_refresh_at;
  }

  const supabase = createSupabaseServiceClient();
  const { data: menuRow } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return menuRow?.updated_at ?? null;
}

export async function getMorningRefreshJob(organizationId: string): Promise<MorningRefreshJob | null> {
  const stateRow = await loadRefreshStateRow(organizationId);
  return parseMorningRefreshJob(stateRow?.morning_job ?? null);
}

export async function saveMorningRefreshJob(params: {
  organizationId: string;
  job: MorningRefreshJob;
  lastRefreshAt?: string | null;
  lastRefreshOk?: boolean;
  trigger?: DataRefreshTrigger;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const existing = await loadRefreshStateRow(params.organizationId);

  const payload: Record<string, unknown> = {
    organization_id: params.organizationId,
    last_refresh_at: params.lastRefreshAt ?? existing?.last_refresh_at ?? null,
    last_refresh_trigger: params.trigger ?? existing?.last_refresh_trigger ?? "scheduled_cron",
    last_refresh_ok: params.lastRefreshOk ?? existing?.last_refresh_ok ?? true,
    morning_job: params.job,
    updated_at: now
  };

  const { error } = await supabase.from("organization_data_refresh_state").upsert(payload, {
    onConflict: "organization_id"
  });

  if (!error) return;

  const message = error.message.toLowerCase();
  if (message.includes("morning_job") || message.includes("column")) {
    console.warn(
      "[data-refresh] morning_job_column_missing: applica la migration organization_morning_refresh_job"
    );
    const withoutJob = { ...payload };
    delete withoutJob.morning_job;
    const retry = await supabase.from("organization_data_refresh_state").upsert(withoutJob, {
      onConflict: "organization_id"
    });
    if (retry.error) {
      console.warn("[data-refresh] save_job_fallback_failed:", retry.error.message);
    }
    return;
  }

  console.warn("[data-refresh] save_job_failed:", error.message);
}

export async function recordDataRefreshCompletion(params: {
  organizationId: string;
  trigger: DataRefreshTrigger;
  ok: boolean;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const existing = await loadRefreshStateRow(params.organizationId);
  const payload: Record<string, unknown> = {
    organization_id: params.organizationId,
    last_refresh_at: now,
    last_refresh_trigger: params.trigger,
    last_refresh_ok: params.ok,
    updated_at: now
  };
  if (existing?.morning_job != null) {
    payload.morning_job = existing.morning_job;
  }

  const { error } = await supabase.from("organization_data_refresh_state").upsert(payload, {
    onConflict: "organization_id"
  });

  if (error) {
    console.warn("[data-refresh] record_completion_failed:", error.message);
  }
}
