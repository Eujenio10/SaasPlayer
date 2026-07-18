import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

let cachedTrendTablesAvailable: boolean | undefined;
let cachedTrendTablesAt = 0;
const TREND_TABLES_TTL_MS = 60_000;

function isMissingTableError(message: string): boolean {
  return message.includes("Could not find the table") || message.includes("does not exist");
}

/** Verifica che le migration Trend siano state applicate su Supabase. */
export async function areTrendDatabaseTablesAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    cachedTrendTablesAvailable !== undefined &&
    now - cachedTrendTablesAt < TREND_TABLES_TTL_MS
  ) {
    return cachedTrendTablesAvailable;
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("player_match_trend_stats").select("match_id").limit(1);
  if (!error) {
    cachedTrendTablesAvailable = true;
  } else if (isMissingTableError(error.message)) {
    cachedTrendTablesAvailable = false;
  } else {
    cachedTrendTablesAvailable = false;
    console.warn("[trends] tables_probe_failed", { message: error.message });
  }
  cachedTrendTablesAt = now;
  return cachedTrendTablesAvailable;
}
