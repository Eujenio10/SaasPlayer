import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

let tablesChecked: boolean | null = null;

export async function areMatchRadarDatabaseTablesAvailable(): Promise<boolean> {
  if (tablesChecked != null) return tablesChecked;
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("match_radar_scores").select("match_id").limit(1);
  tablesChecked = !error;
  return tablesChecked;
}

export function resetMatchRadarTablesCacheForTests(): void {
  tablesChecked = null;
}
