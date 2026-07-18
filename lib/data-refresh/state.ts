import type { DataRefreshTrigger } from "@/lib/data-refresh/config";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export async function getLastDataRefreshAt(organizationId: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient();

  const { data: stateRow, error: stateError } = await supabase
    .from("organization_data_refresh_state")
    .select("last_refresh_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!stateError && stateRow?.last_refresh_at) {
    return stateRow.last_refresh_at;
  }

  const { data: menuRow } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return menuRow?.updated_at ?? null;
}

export async function recordDataRefreshCompletion(params: {
  organizationId: string;
  trigger: DataRefreshTrigger;
  ok: boolean;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("organization_data_refresh_state").upsert(
    {
      organization_id: params.organizationId,
      last_refresh_at: now,
      last_refresh_trigger: params.trigger,
      last_refresh_ok: params.ok,
      updated_at: now
    },
    { onConflict: "organization_id" }
  );

  if (error) {
    console.warn("[data-refresh] record_completion_failed:", error.message);
  }
}
