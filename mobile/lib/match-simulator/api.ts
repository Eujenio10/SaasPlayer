import { env } from "@/lib/env";
import { buildMobileHeaders, fetchWithTimeout } from "@/lib/mobile-http";
import type {
  MatchSimulatorDetailResponse,
  MatchSimulatorFixturesResponse
} from "@/lib/match-simulator/types";

/** Generazione on-demand: backfill stats + Monte Carlo. Allineato a maxDuration 120s della route. */
const SIMULATOR_DETAIL_TIMEOUT_MS = 110_000;

async function buildHeaders(): Promise<HeadersInit> {
  return buildMobileHeaders();
}

export async function fetchMatchSimulatorFixtures(params: {
  competitionId: string;
  round?: string;
}): Promise<MatchSimulatorFixturesResponse> {
  const search = new URLSearchParams({ competitionId: params.competitionId });
  if (params.round) search.set("round", params.round);
  search.set("_", String(Date.now()));

  const res = await fetchWithTimeout(`${env.apiUrl}/api/mobile/match-simulator/fixtures?${search.toString()}`, {
    headers: await buildHeaders(),
    cache: "no-store"
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `match_simulator_fixtures_failed_${res.status}`);
  }
  return (await res.json()) as MatchSimulatorFixturesResponse;
}

export async function fetchMatchSimulatorDetail(
  fixtureId: string
): Promise<MatchSimulatorDetailResponse> {
  const res = await fetchWithTimeout(
    `${env.apiUrl}/api/mobile/match-simulator/${encodeURIComponent(fixtureId)}`,
    {
      headers: await buildHeaders(),
      cache: "no-store"
    },
    SIMULATOR_DETAIL_TIMEOUT_MS
  );
  if (!res.ok) throw new Error("match_simulator_detail_failed");
  return (await res.json()) as MatchSimulatorDetailResponse;
}
