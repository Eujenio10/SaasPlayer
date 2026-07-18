import { ensureTeamStatsForFixture } from "@/lib/match-simulator/ingestion";

import {

  buildLineupAdjustment,

  lineupVersionFromSides,

  parseLineupSide

} from "@/lib/match-simulator/lineup";

import { runMonteCarloSimulation } from "@/lib/match-simulator/monte-carlo";

import {

  buildCompetitionMetricProfile,

  buildRefereeProfile,

  buildTeamSimulationProfile

} from "@/lib/match-simulator/profile";

import {

  loadCompetitionTeamMatchStatsForSimulation,

  loadRefereeMatchStats,

  loadTeamMatchStatsForSimulation

} from "@/lib/match-simulator/persist";

import { matchCompetitionId } from "@/lib/match-simulator/query";

import { minSampleForCompetition } from "@/lib/match-simulator/sample-requirements";

import type { MatchSimulationResult } from "@/lib/match-simulator/types";

import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";

import {

  sportApiEventLineupsPath,

  sportApiEventPath

} from "@/lib/sportapi-endpoints";

import type { UpcomingMatchItem } from "@/services/sportapi";
import { resolveEffectiveSeasonContextForTeam } from "@/services/sportapi";


export interface SimulateFixtureResult {

  ok: boolean;

  result?: MatchSimulationResult;

  lineupVersion: string;

  message?: string;

  insufficientData?: boolean;

}



export async function simulateFixture(params: {

  match: UpcomingMatchItem;

  simulationsCount?: number;

  seed?: number;

  skipFootApiLineupFetch?: boolean;

}): Promise<SimulateFixtureResult> {

  const fixtureId = String(params.match.eventId);

  const competitionId = matchCompetitionId(params.match);

  const minSample = minSampleForCompetition(competitionId);



  const [homeSeason, awaySeason] = await Promise.all([
    resolveEffectiveSeasonContextForTeam({
      teamId: params.match.homeTeam.id,
      eventId: params.match.eventId
    }),
    resolveEffectiveSeasonContextForTeam({
      teamId: params.match.awayTeam.id,
      eventId: params.match.eventId
    })
  ]);
  const ctx =
    homeSeason.mode === "previous_season"
      ? homeSeason.effective
      : awaySeason.mode === "previous_season"
        ? awaySeason.effective
        : homeSeason.effective ?? awaySeason.effective;
  const seasonId = ctx ? String(ctx.seasonId) : "unknown";


  await ensureTeamStatsForFixture({

    homeTeamId: params.match.homeTeam.id,

    awayTeamId: params.match.awayTeam.id,

    anchorEventId: params.match.eventId,

    competitionId

  });



  const competitionRows = await loadCompetitionTeamMatchStatsForSimulation({

    competitionId,

    seasonId,

    limit: 900

  });



  const [homeRows, awayRows] = await Promise.all([

    loadTeamMatchStatsForSimulation({

      teamId: String(params.match.homeTeam.id),

      competitionId,

      seasonId,

      limit: 30

    }),

    loadTeamMatchStatsForSimulation({

      teamId: String(params.match.awayTeam.id),

      competitionId,

      seasonId,

      limit: 30

    })

  ]);



  const homeProfile = buildTeamSimulationProfile({

    teamId: String(params.match.homeTeam.id),

    competitionId,

    seasonId,

    rows: homeRows,

    competitionRows,

    venue: "home"

  });

  const awayProfile = buildTeamSimulationProfile({

    teamId: String(params.match.awayTeam.id),

    competitionId,

    seasonId,

    rows: awayRows,

    competitionRows,

    venue: "away"

  });



  if (!homeProfile || !awayProfile) {

    console.info("[match-simulator] profile_missing", {

      fixtureId,

      competitionId,

      homeRows: homeRows.length,

      awayRows: awayRows.length

    });

    return {

      ok: false,

      lineupVersion: "none",

      insufficientData: true,

      message: "Dati insufficienti per generare una simulazione affidabile di questa partita."

    };

  }



  if (

    homeProfile.sampleMatches < minSample.teamSeasonMatches ||

    awayProfile.sampleMatches < minSample.teamSeasonMatches ||

    homeProfile.dataCompleteness < minSample.dataCompleteness ||

    awayProfile.dataCompleteness < minSample.dataCompleteness

  ) {

    console.info("[match-simulator] sample_below_threshold", {

      fixtureId,

      competitionId,

      minSample,

      home: {

        matches: homeProfile.sampleMatches,

        completeness: homeProfile.dataCompleteness

      },

      away: {

        matches: awayProfile.sampleMatches,

        completeness: awayProfile.dataCompleteness

      }

    });

    return {

      ok: false,

      lineupVersion: "none",

      insufficientData: true,

      message: "Dati insufficienti per generare una simulazione affidabile di questa partita."

    };

  }



  const competition = buildCompetitionMetricProfile({

    competitionId,

    seasonId,

    rows: competitionRows.length > 0 ? competitionRows : [...homeRows, ...awayRows]

  });



  let lineupVersion = "none";

  let homeLineup = buildLineupAdjustment(null);

  let awayLineup = buildLineupAdjustment(null);



  if (!params.skipFootApiLineupFetch) {

    const lineupsResponse = await footApiFetch(sportApiEventLineupsPath(params.match.eventId));

    if (lineupsResponse.ok) {

      const lineups = (await lineupsResponse.json()) as {

        home?: { players?: Array<{ player?: { id?: number }; substitute?: boolean; position?: string }> };

        away?: { players?: Array<{ player?: { id?: number }; substitute?: boolean; position?: string }> };

      };

      const homeSide = parseLineupSide(lineups.home?.players);

      const awaySide = parseLineupSide(lineups.away?.players);

      homeLineup = buildLineupAdjustment(homeSide);

      awayLineup = buildLineupAdjustment(awaySide);

      lineupVersion = lineupVersionFromSides({ home: homeSide, away: awaySide });

    }

  }



  let refereeProfile = null;

  const eventResponse = await footApiFetch(sportApiEventPath(params.match.eventId));

  if (eventResponse.ok) {

    const eventPayload = (await eventResponse.json()) as {

      event?: { referee?: { id?: number } };

    };

    const refereeId = eventPayload.event?.referee?.id;

    if (refereeId != null) {

      const refereeRows = await loadRefereeMatchStats(String(refereeId));

      refereeProfile = buildRefereeProfile({

        refereeId: String(refereeId),

        rows: refereeRows,

        competition

      });

      if (!refereeProfile) {

        console.info("[match-simulator] referee_profile_ignored", { fixtureId, refereeId });

      } else {

        console.info("[match-simulator] referee_profile_applied", { fixtureId, refereeId });

      }

    }

  }



  const startedAt = Date.now();

  const result = runMonteCarloSimulation({

    fixtureId,

    homeTeamId: String(params.match.homeTeam.id),

    awayTeamId: String(params.match.awayTeam.id),

    homeTeamName: params.match.homeTeam.name,

    awayTeamName: params.match.awayTeam.name,

    home: homeProfile,

    away: awayProfile,

    competition,

    referee: refereeProfile,

    lineup: { home: homeLineup, away: awayLineup },

    lineupVersion,

    simulationsCount: params.simulationsCount,

    seed: params.seed,

    historicalRows:

      competitionRows.length > 0 ? competitionRows : [...homeRows, ...awayRows]

  });



  console.info("[match-simulator] simulation_generated", {

    fixtureId,

    competitionId,

    homeSample: homeProfile.sampleMatches,

    awaySample: awayProfile.sampleMatches,

    simulationsCount: result.simulationsCount,

    elapsedMs: Date.now() - startedAt,

    reliabilityScore: result.reliabilityScore,

    modelVersion: result.modelVersion,

    lineupVersion

  });



  return { ok: true, result, lineupVersion };

}


