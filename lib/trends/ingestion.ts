import { adaptFootApiMatchTrendBundle } from "@/lib/trends/footapi-adapter";
import { areTrendDatabaseTablesAvailable } from "@/lib/trends/db-tables";
import {
  loadMatchStatsIngestion,
  savePlayerMatchTrendStats,
  upsertMatchStatsIngestion,
  upsertPlayerTrendAggregate,
  loadPlayerAppearances
} from "@/lib/trends/persist";
import { resolveCompetitionId } from "@/lib/competitions";
import {
  fetchFootApiMatchTrendSourceBundle,
  fetchFootApiTeamFinishedEvents,
  fetchFootApiTeamFinishedEventsBroad,
  resolveEffectiveSeasonContextForTeam
} from "@/services/sportapi";

export interface MatchIngestionResult {
  matchId: string;
  skipped: boolean;
  playersSaved: number;
  error?: string;
}

export async function ingestMatchPlayerTrendStatsIfNeeded(
  eventId: number
): Promise<MatchIngestionResult> {
  if (!(await areTrendDatabaseTablesAvailable())) {
    return { matchId: String(eventId), skipped: true, playersSaved: 0, error: "trend_tables_missing" };
  }

  const matchId = String(eventId);
  const existing = await loadMatchStatsIngestion(matchId);
  if (existing?.playerStatsComplete) {
    console.info("[trends] ingestion_skipped_complete", { matchId });
    return { matchId, skipped: true, playersSaved: 0 };
  }

  const attempts = (existing?.attempts ?? 0) + 1;
  await upsertMatchStatsIngestion({
    matchId,
    competitionId: existing?.competitionId ?? "pending",
    seasonId: existing?.seasonId ?? "pending",
    playerStatsDownloaded: false,
    playerStatsComplete: false,
    attempts,
    downloadedAt: null,
    lastError: null
  });

  const bundle = await fetchFootApiMatchTrendSourceBundle(eventId);
  if (!bundle) {
    await upsertMatchStatsIngestion({
      matchId,
      competitionId: existing?.competitionId ?? "unknown",
      seasonId: existing?.seasonId ?? "unknown",
      playerStatsDownloaded: false,
      playerStatsComplete: false,
      attempts,
      downloadedAt: null,
      lastError: "footapi_bundle_failed"
    });
    return { matchId, skipped: false, playersSaved: 0, error: "footapi_bundle_failed" };
  }

  const competitionId = resolveCompetitionId(bundle.competitionSlug) || bundle.competitionSlug;
  const seasonId = String(bundle.seasonId);
  const rows = adaptFootApiMatchTrendBundle(bundle);
  const saved = await savePlayerMatchTrendStats(rows);

  await upsertMatchStatsIngestion({
    matchId,
    competitionId,
    seasonId,
    playerStatsDownloaded: true,
    playerStatsComplete: saved > 0,
    attempts,
    downloadedAt: new Date().toISOString(),
    lastError: saved > 0 ? null : "no_player_rows"
  });

  const playerIds = [...new Set(rows.map((row) => row.playerId))];
  for (const playerId of playerIds) {
    const appearances = await loadPlayerAppearances({ playerId, competitionId, seasonId });
    await upsertPlayerTrendAggregate({ playerId, competitionId, seasonId, appearances });
  }

  console.info("[trends] ingestion_complete", { matchId, playersSaved: saved, playerIds: playerIds.length });
  return { matchId, skipped: false, playersSaved: saved };
}

export async function backfillTeamTrendMatches(params: {
  teamId: number;
  anchorEventId: number;
  maxEvents?: number;
}): Promise<{ ingested: number; skipped: number; errors: number }> {
  if (!(await areTrendDatabaseTablesAvailable())) {
    return { ingested: 0, skipped: 0, errors: 0 };
  }

  const resolved = await resolveEffectiveSeasonContextForTeam({
    teamId: params.teamId,
    eventId: params.anchorEventId
  });
  const ctx = resolved.effective;
  if (!ctx) return { ingested: 0, skipped: 0, errors: 1 };

  // In fallback giocatori: preferisci stagione precedente; se any-competition, Broad arriva da ingest per match.
  let events = await fetchFootApiTeamFinishedEvents({
    teamId: params.teamId,
    tournamentId: ctx.tournamentId,
    seasonId: ctx.seasonId,
    maxEvents: params.maxEvents ?? 20
  });

  if (!events.length) {
    events = await fetchFootApiTeamFinishedEventsBroad({
      teamId: params.teamId,
      preferredTournamentId: ctx.tournamentId,
      preferredSeasonId: ctx.seasonId,
      maxEvents: params.maxEvents ?? 20
    });
    console.info("[trends] team_backfill_broad_fallback", {
      teamId: params.teamId,
      tournamentId: ctx.tournamentId,
      seasonId: ctx.seasonId,
      events: events.length
    });
  }

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events) {
    const eventId = event.id as number;
    const result = await ingestMatchPlayerTrendStatsIfNeeded(eventId);
    if (result.skipped) skipped += 1;
    else if (result.playersSaved > 0) ingested += 1;
    else errors += 1;
  }

  console.info("[trends] team_backfill_done", {
    teamId: params.teamId,
    anchorEventId: params.anchorEventId,
    ingested,
    skipped,
    errors
  });

  return { ingested, skipped, errors };
}
