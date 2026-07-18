import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { ingestMatchPlayerTrendStatsIfNeeded } from "@/lib/trends/ingestion";

export async function ensureFixturePlayerStatsCached(eventIds: number[]): Promise<{
  ingested: number;
  skipped: number;
  errors: number;
  rateLimited: boolean;
}> {
  const unique = [...new Set(eventIds.filter((id) => id > 0))];
  let ingested = 0;
  let skipped = 0;
  let errors = 0;
  let rateLimited = false;

  for (const eventId of unique) {
    const result = await ingestMatchPlayerTrendStatsIfNeeded(eventId);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    if (result.playersSaved > 0) {
      ingested += 1;
      continue;
    }
    errors += 1;
    if (result.error === "footapi_bundle_failed") {
      rateLimited = true;
      console.warn("[player-performance] ingestion_stopped_rate_limit", { eventId });
      break;
    }
  }

  return { ingested, skipped, errors, rateLimited };
}
