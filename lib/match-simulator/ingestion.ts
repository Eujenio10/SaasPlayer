import { resolveCompetitionId, resolveMatchCompetitionId } from "@/lib/competitions";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import {
  adaptFootApiTeamMatchStatsBundle,
  parseFootApiEventToTeamMatchBundle
} from "@/lib/match-simulator/footapi-adapter";
import {
  loadTeamMatchStatsIngestion,
  saveTeamMatchStats,
  upsertTeamMatchStatsIngestion
} from "@/lib/match-simulator/persist";
import { isInternationalSimulatorCompetition } from "@/lib/match-simulator/sample-requirements";
import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";
import {
  sportApiEventPath,
  sportApiEventStatisticsPath
} from "@/lib/sportapi-endpoints";
import {
  fetchFootApiTeamFinishedEvents,
  resolveEffectiveSeasonContextForTeam
} from "@/services/sportapi";

export interface TeamMatchIngestionResult {
  matchId: string;
  skipped: boolean;
  rowsSaved: number;
  error?: string;
}

export async function ingestTeamMatchStatsIfNeeded(eventId: number): Promise<TeamMatchIngestionResult> {
  if (!(await areMatchSimulatorDatabaseTablesAvailable())) {
    return { matchId: String(eventId), skipped: true, rowsSaved: 0, error: "simulator_tables_missing" };
  }

  const matchId = String(eventId);
  const existing = await loadTeamMatchStatsIngestion(matchId);
  if (existing?.teamStatsComplete) {
    console.info("[match-simulator] ingestion_skipped_complete", { matchId });
    return { matchId, skipped: true, rowsSaved: 0 };
  }

  const attempts = (existing?.attempts ?? 0) + 1;
  await upsertTeamMatchStatsIngestion({
    matchId,
    competitionId: existing?.competitionId ?? "pending",
    seasonId: existing?.seasonId ?? "pending",
    teamStatsDownloaded: false,
    teamStatsComplete: false,
    attempts,
    downloadedAt: null,
    lastError: null
  });

  const [eventResponse, statsResponse] = await Promise.all([
    footApiFetch(sportApiEventPath(eventId)),
    footApiFetch(sportApiEventStatisticsPath(eventId))
  ]);

  if (!eventResponse.ok || !statsResponse.ok) {
    await upsertTeamMatchStatsIngestion({
      matchId,
      competitionId: existing?.competitionId ?? "unknown",
      seasonId: existing?.seasonId ?? "unknown",
      teamStatsDownloaded: false,
      teamStatsComplete: false,
      attempts,
      downloadedAt: null,
      lastError: "footapi_event_or_stats_failed"
    });
    return { matchId, skipped: false, rowsSaved: 0, error: "footapi_event_or_stats_failed" };
  }

  const eventPayload = await eventResponse.json();
  const statisticsPayload = await statsResponse.json();
  const bundle = parseFootApiEventToTeamMatchBundle({
    eventId,
    eventPayload,
    statisticsPayload
  });

  if (!bundle) {
    await upsertTeamMatchStatsIngestion({
      matchId,
      competitionId: existing?.competitionId ?? "unknown",
      seasonId: existing?.seasonId ?? "unknown",
      teamStatsDownloaded: false,
      teamStatsComplete: false,
      attempts,
      downloadedAt: null,
      lastError: "parse_failed"
    });
    return { matchId, skipped: false, rowsSaved: 0, error: "parse_failed" };
  }

  const competitionId =
    resolveMatchCompetitionId({ competitionSlug: bundle.competitionSlug }) ||
    resolveCompetitionId(bundle.competitionSlug) ||
    bundle.competitionSlug;
  const rows = adaptFootApiTeamMatchStatsBundle(bundle);
  const saved = await saveTeamMatchStats(rows);

  await upsertTeamMatchStatsIngestion({
    matchId,
    competitionId,
    seasonId: String(bundle.seasonId),
    teamStatsDownloaded: true,
    teamStatsComplete: saved >= 2,
    attempts,
    downloadedAt: new Date().toISOString(),
    lastError: saved >= 2 ? null : "no_team_rows"
  });

  console.info("[match-simulator] ingestion_complete", { matchId, rowsSaved: saved });
  return { matchId, skipped: false, rowsSaved: saved };
}

export async function backfillTeamMatchStatsForTeam(params: {
  teamId: number;
  anchorEventId: number;
  maxEvents?: number;
}): Promise<{ ingested: number; skipped: number; errors: number }> {
  if (!(await areMatchSimulatorDatabaseTablesAvailable())) {
    return { ingested: 0, skipped: 0, errors: 0 };
  }

  const resolved = await resolveEffectiveSeasonContextForTeam({
    teamId: params.teamId,
    eventId: params.anchorEventId
  });
  const ctx = resolved.effective;
  if (!ctx) return { ingested: 0, skipped: 0, errors: 1 };

  const events = await fetchFootApiTeamFinishedEvents({
    teamId: params.teamId,
    tournamentId: ctx.tournamentId,
    seasonId: ctx.seasonId,
    maxEvents: params.maxEvents ?? 18
  });

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events) {
    const eventId = event.id as number;
    const result = await ingestTeamMatchStatsIfNeeded(eventId);
    if (result.skipped) skipped += 1;
    else if (result.rowsSaved > 0) ingested += 1;
    else errors += 1;
  }

  console.info("[match-simulator] team_backfill_done", {
    teamId: params.teamId,
    anchorEventId: params.anchorEventId,
    ingested,
    skipped,
    errors
  });

  return { ingested, skipped, errors };
}

export async function ensureTeamStatsForFixture(params: {
  homeTeamId: number;
  awayTeamId: number;
  anchorEventId: number;
  competitionId?: string;
}): Promise<void> {
  const maxEvents = params.competitionId && isInternationalSimulatorCompetition(params.competitionId) ? 24 : 18;
  await Promise.all([
    backfillTeamMatchStatsForTeam({
      teamId: params.homeTeamId,
      anchorEventId: params.anchorEventId,
      maxEvents
    }),
    backfillTeamMatchStatsForTeam({
      teamId: params.awayTeamId,
      anchorEventId: params.anchorEventId,
      maxEvents
    })
  ]);
}
