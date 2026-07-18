import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

let cachedSimulatorTablesAvailable: boolean | undefined;
let cachedSimulatorTablesAt = 0;
const SIMULATOR_TABLES_TTL_MS = 60_000;

function isMissingTableError(message: string): boolean {
  return message.includes("Could not find the table") || message.includes("does not exist");
}

export async function areMatchSimulatorDatabaseTablesAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    cachedSimulatorTablesAvailable !== undefined &&
    now - cachedSimulatorTablesAt < SIMULATOR_TABLES_TTL_MS
  ) {
    return cachedSimulatorTablesAvailable;
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("team_match_stats").select("fixture_id").limit(1);
  if (!error) {
    cachedSimulatorTablesAvailable = true;
  } else if (isMissingTableError(error.message)) {
    cachedSimulatorTablesAvailable = false;
  } else {
    cachedSimulatorTablesAvailable = false;
    console.warn("[match-simulator] tables_probe_failed", { message: error.message });
  }
  cachedSimulatorTablesAt = now;
  return cachedSimulatorTablesAvailable;
}
