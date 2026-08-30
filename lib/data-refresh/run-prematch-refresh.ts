import { PREMATCH_REFRESH_CONFIG } from "@/lib/data-refresh/config";
import { recordDataRefreshCompletion } from "@/lib/data-refresh/state";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";
import {
  loadOrganizationDifficultMarkingsSnapshot,
  regenerateDifficultMarkingsSnapshotForOrganization
} from "@/lib/difficult-markings/snapshot";
import { invalidateDifficultMarkingsSnapshotMemory } from "@/lib/difficult-markings/snapshot-memory-cache";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import {
  generateAndCacheSimulation,
  loadOrganizationMatchSimulatorSnapshot
} from "@/lib/match-simulator/snapshot";
import { loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import type { UpcomingMatchItem } from "@/services/sportapi";

const SECONDS_PER_MINUTE = 60;

export interface PrematchMatchOutcome {
  eventId: number;
  label: string;
  competitionSlug: string;
  minutesToKickoff: number;
  ok: boolean;
  error?: string;
}

export interface PrematchRefreshTickResult {
  ok: boolean;
  /** Partite in menu esaminate. */
  scanned: number;
  /** Partite dentro la finestra pre-partita. */
  due: number;
  processed: number;
  matches: PrematchMatchOutcome[];
  competitions: string[];
  markingsUpdated: boolean;
  /** Orario mostrato dal banner "Ultimo aggiornamento", scritto solo se qualcosa è cambiato. */
  lastRefreshAt?: string;
  reason?: string;
}

/** Partite con calcio d'inizio dentro la finestra pre-partita, dalla più imminente. */
export function selectPrematchDueMatches(params: {
  matches: UpcomingMatchItem[];
  nowSec: number;
}): UpcomingMatchItem[] {
  const { leadMinutes, cutoffMinutes } = PREMATCH_REFRESH_CONFIG;
  return params.matches
    .filter((match) => {
      if (!(match.startTimestamp > 0)) return false;
      const secondsToKickoff = match.startTimestamp - params.nowSec;
      return (
        secondsToKickoff <= leadMinutes * SECONDS_PER_MINUTE &&
        secondsToKickoff >= cutoffMinutes * SECONDS_PER_MINUTE
      );
    })
    .sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * Deduplica senza stato dedicato: una partita è già stata rinfrescata se la
 * simulazione salvata è stata generata dopo l'apertura della sua finestra.
 * Così un ping ripetuto non rifà il lavoro, ma un tentativo fallito riparte.
 */
export function alreadyRefreshedBeforeKickoff(params: {
  generatedAt?: string;
  startTimestamp: number;
}): boolean {
  if (!params.generatedAt) return false;
  const generatedMs = Date.parse(params.generatedAt);
  if (!Number.isFinite(generatedMs)) return false;
  const windowOpensMs =
    (params.startTimestamp - PREMATCH_REFRESH_CONFIG.leadMinutes * SECONDS_PER_MINUTE) * 1000;
  return generatedMs >= windowOpensMs;
}

function emptyTick(
  scanned: number,
  due: number,
  reason: string,
  ok = true
): PrematchRefreshTickResult {
  return {
    ok,
    scanned,
    due,
    processed: 0,
    matches: [],
    competitions: [],
    markingsUpdated: false,
    reason
  };
}

/**
 * Rinfresco leggero prima del calcio d'inizio: rigenera la simulazione con le
 * formazioni ufficiali e riallinea le marcature difficili della competizione.
 * Insight, trend e player performance restano al giro mattutino.
 */
export async function runPrematchRefreshTick(params: {
  organizationId: string;
  now?: Date;
}): Promise<PrematchRefreshTickResult> {
  const now = params.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const startedAt = Date.now();

  const menu = await loadOrganizationUpcomingMenuMatches(params.organizationId);
  const due = selectPrematchDueMatches({ matches: menu, nowSec });

  if (due.length === 0) {
    return emptyTick(menu.length, 0, "no_match_in_window");
  }

  if (!(await areMatchSimulatorDatabaseTablesAvailable())) {
    return emptyTick(menu.length, due.length, "simulator_tables_missing", false);
  }

  const simulatorSnapshot = await loadOrganizationMatchSimulatorSnapshot(params.organizationId);
  const pending = due
    .filter(
      (match) =>
        !alreadyRefreshedBeforeKickoff({
          generatedAt: simulatorSnapshot?.simulationIndex?.[String(match.eventId)]?.generatedAt,
          startTimestamp: match.startTimestamp
        })
    )
    .slice(0, PREMATCH_REFRESH_CONFIG.maxMatchesPerTick);

  if (pending.length === 0) {
    return emptyTick(menu.length, due.length, "already_refreshed");
  }

  const markingsSnapshot = await loadOrganizationDifficultMarkingsSnapshot(params.organizationId);
  const insightsSnap =
    markingsSnapshot?.insightsSnap || simulatorSnapshot?.insightsSnap || nowSec;

  const matches: PrematchMatchOutcome[] = [];
  const refreshedCompetitions = new Set<string>();

  for (const match of pending) {
    if (Date.now() - startedAt > PREMATCH_REFRESH_CONFIG.timeBudgetMs) {
      console.warn("[prematch-refresh] budget_exhausted", {
        processed: matches.length,
        remaining: pending.length - matches.length
      });
      break;
    }

    const outcome: PrematchMatchOutcome = {
      eventId: match.eventId,
      label: `${match.homeTeam.name} - ${match.awayTeam.name}`,
      competitionSlug: match.competitionSlug,
      minutesToKickoff: Math.round((match.startTimestamp - nowSec) / SECONDS_PER_MINUTE),
      ok: false
    };

    try {
      const simulated = await generateAndCacheSimulation({
        organizationId: params.organizationId,
        match,
        insightsSnap,
        force: true
      });
      outcome.ok = simulated.ok;
      outcome.error = simulated.ok ? undefined : simulated.message;
      if (simulated.ok) refreshedCompetitions.add(canonicalCompetitionId(match.competitionSlug));
    } catch (error) {
      outcome.error = error instanceof Error ? error.message : String(error);
    }

    matches.push(outcome);
  }

  /**
   * Le marcature vanno rigenerate competizione per competizione passando tutte
   * le partite in menu di quella competizione: `mergeCompetitionIds` sostituisce
   * l'intero blocco, quindi con la sola partita in finestra si perderebbero le altre.
   */
  let markingsUpdated = false;
  for (const competitionId of refreshedCompetitions) {
    const competitionMatches = menu.filter(
      (match) => canonicalCompetitionId(match.competitionSlug) === competitionId
    );
    if (competitionMatches.length === 0) continue;

    try {
      const markings = await regenerateDifficultMarkingsSnapshotForOrganization({
        organizationId: params.organizationId,
        matches: competitionMatches,
        insightsSnap,
        mergeCompetitionIds: [competitionId]
      });
      if (markings.ok) markingsUpdated = true;
      else console.warn("[prematch-refresh] markings_not_persisted", { competitionId, message: markings.message });
    } catch (error) {
      console.warn(
        "[prematch-refresh] markings_error:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (markingsUpdated) {
    invalidateDifficultMarkingsSnapshotMemory(params.organizationId);
  }

  const processed = matches.filter((match) => match.ok).length;

  /** Allinea il banner "Ultimo aggiornamento": senza questo mostrerebbe ancora il giro mattutino. */
  let lastRefreshAt: string | undefined;
  if (processed > 0) {
    lastRefreshAt = new Date().toISOString();
    await recordDataRefreshCompletion({
      organizationId: params.organizationId,
      trigger: "scheduled_cron",
      ok: true
    });
  }

  console.info("[prematch-refresh] tick", {
    scanned: menu.length,
    due: due.length,
    attempted: matches.length,
    processed,
    competitions: [...refreshedCompetitions],
    markingsUpdated,
    lastRefreshAt,
    elapsedMs: Date.now() - startedAt
  });

  return {
    ok: processed > 0,
    scanned: menu.length,
    due: due.length,
    processed,
    matches,
    competitions: [...refreshedCompetitions],
    markingsUpdated,
    lastRefreshAt,
    reason: processed > 0 ? undefined : "all_matches_failed"
  };
}
