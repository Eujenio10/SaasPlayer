import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { buildMatchPlayerPerformanceQuery } from "@/lib/player-performance/hints";
import { isPlayerPerformanceAnchorStillUpcoming } from "@/lib/player-performance/fixture-eligibility";
import { PLAYER_PERFORMANCE_TEXT } from "@/lib/player-performance/text";
import { supabase } from "@/lib/supabase";
import type { MatchPlayerPerformance } from "@/lib/player-performance/types";

async function buildHeaders(): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId()
  ]);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId
  };
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }
  return headers;
}

export async function fetchMatchPlayerPerformance(
  eventId: number,
  hints?: {
    homeTeamId?: number;
    awayTeamId?: number;
    homeTeamName?: string;
    awayTeamName?: string;
    startTimestamp?: number;
  }
): Promise<MatchPlayerPerformance> {
  const query =
    hints?.homeTeamId && hints?.awayTeamId
      ? `?${buildMatchPlayerPerformanceQuery({
          homeTeamId: hints.homeTeamId,
          awayTeamId: hints.awayTeamId,
          homeTeamName: hints.homeTeamName,
          awayTeamName: hints.awayTeamName,
          startTimestamp: hints.startTimestamp
        })}&_=${Date.now()}`
      : `?_${Date.now()}`;

  const res = await fetch(`${env.apiUrl}/api/mobile/match-player-performance/${eventId}${query}`, {
    headers: await buildHeaders(),
    cache: "no-store"
  });

  if (res.status === 410) {
    throw new Error("player_performance_match_started");
  }
  if (res.status === 404) {
    throw new Error("player_performance_not_ready");
  }
  if (!res.ok) throw new Error("player_performance_fetch_failed");
  return res.json();
}

export function isMatchEligibleForPlayerPerformance(params: {
  eventId: number;
  startTimestamp?: number;
}): boolean {
  if (!params.startTimestamp || params.startTimestamp <= 0) return true;
  return isPlayerPerformanceAnchorStillUpcoming({
    fixtureId: params.eventId,
    kickoffTimestamp: params.startTimestamp
  });
}

export function playerPerformanceUnavailableMessage(error: unknown): string {
  if (error instanceof Error && error.message === "player_performance_match_started") {
    return PLAYER_PERFORMANCE_TEXT.matchAlreadyStarted;
  }
  if (error instanceof Error && error.message === "player_performance_not_ready") {
    return PLAYER_PERFORMANCE_TEXT.notReady;
  }
  return PLAYER_PERFORMANCE_TEXT.error;
}
