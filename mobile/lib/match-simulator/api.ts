import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { supabase } from "@/lib/supabase";
import type {
  MatchSimulatorDetailResponse,
  MatchSimulatorFixturesResponse
} from "@/lib/match-simulator/types";

async function buildHeaders(): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId()
  ]);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    "X-PitchBrain-Client": "mobile"
  };
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }
  return headers;
}

export async function fetchMatchSimulatorFixtures(params: {
  competitionId: string;
  round?: string;
}): Promise<MatchSimulatorFixturesResponse> {
  const search = new URLSearchParams({ competitionId: params.competitionId });
  if (params.round) search.set("round", params.round);
  search.set("_", String(Date.now()));

  const res = await fetch(`${env.apiUrl}/api/mobile/match-simulator/fixtures?${search.toString()}`, {
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
  const res = await fetch(
    `${env.apiUrl}/api/mobile/match-simulator/${encodeURIComponent(fixtureId)}`,
    {
      headers: await buildHeaders(),
      cache: "no-store"
    }
  );
  if (!res.ok) throw new Error("match_simulator_detail_failed");
  return (await res.json()) as MatchSimulatorDetailResponse;
}
