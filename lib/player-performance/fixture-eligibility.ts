import {
  isCatalogFixtureStillUpcoming,
  nowUnixSeconds
} from "@/lib/trends/fixture-eligibility";

/** Player Performance disponibile solo prima del calcio d'inizio. */
export function isPlayerPerformanceAnchorStillUpcoming(params: {
  fixtureId: number;
  kickoffTimestamp?: number | null;
  kickoffByFixtureId?: Map<string, number>;
  nowSec?: number;
}): boolean {
  return isCatalogFixtureStillUpcoming({
    fixtureId: params.fixtureId,
    snapshotKickoff: params.kickoffTimestamp,
    kickoffByFixtureId: params.kickoffByFixtureId,
    nowSec: params.nowSec ?? nowUnixSeconds()
  });
}

export class PlayerPerformanceMatchStartedError extends Error {
  readonly code = "player_performance_match_started" as const;

  constructor() {
    super("player_performance_match_started");
    this.name = "PlayerPerformanceMatchStartedError";
  }
}

export function assertPlayerPerformancePreMatch(params: {
  fixtureId: number;
  kickoffTimestamp?: number | null;
  kickoffByFixtureId?: Map<string, number>;
  nowSec?: number;
}): void {
  if (!isPlayerPerformanceAnchorStillUpcoming(params)) {
    throw new PlayerPerformanceMatchStartedError();
  }
}
