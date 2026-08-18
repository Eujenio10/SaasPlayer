import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { supabase } from "@/lib/supabase";
import type { DifficultMarkingMatchup } from "./types";

async function buildHeaders(): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId()
  ]);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Device-Id": deviceId,
    "X-PitchBrain-Client": "mobile"
  };
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }
  return headers;
}

export async function fetchDifficultMarkings(params: {
  competitionId: string;
  round?: string;
  eventId?: number;
}): Promise<{
  results: DifficultMarkingMatchup[];
  round: string;
  updatedAt: string | null;
  officialLineupsUsed: boolean;
  snapshotFound: boolean;
  totalStoredMatchups: number;
  totalUpcomingMatchups: number;
  storedCompetitions: string[];
  suggestedCompetitionId: string | null;
  resolvedCompetitionId: string;
}> {
  const search = new URLSearchParams({ competitionId: params.competitionId });
  if (params.round) search.set("round", params.round);
  if (params.eventId != null) search.set("eventId", String(params.eventId));
  search.set("_", String(Date.now()));

  const res = await fetch(`${env.apiUrl}/api/mobile/difficult-markings?${search.toString()}`, {
    headers: await buildHeaders(),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("difficult_markings_load_failed");
  const json = (await res.json()) as {
    results?: DifficultMarkingMatchup[];
    round?: string;
    updatedAt?: string | null;
    officialLineupsUsed?: boolean;
    snapshotFound?: boolean;
    totalStoredMatchups?: number;
    totalUpcomingMatchups?: number;
    storedCompetitions?: string[];
    suggestedCompetitionId?: string | null;
    resolvedCompetitionId?: string;
  };
  const results = Array.isArray(json.results) ? json.results : [];
  const totalStoredMatchups =
    typeof json.totalStoredMatchups === "number" ? json.totalStoredMatchups : 0;
  const totalUpcomingMatchups =
    typeof json.totalUpcomingMatchups === "number" ? json.totalUpcomingMatchups : totalStoredMatchups;
  const suggestedCompetitionId =
    typeof json.suggestedCompetitionId === "string" && json.suggestedCompetitionId.trim()
      ? json.suggestedCompetitionId
      : null;
  const resolvedCompetitionId =
    typeof json.resolvedCompetitionId === "string" && json.resolvedCompetitionId.trim()
      ? json.resolvedCompetitionId
      : params.competitionId;
  return {
    results,
    round: json.round ?? "",
    updatedAt: json.updatedAt ?? null,
    officialLineupsUsed: Boolean(json.officialLineupsUsed),
    snapshotFound: results.length > 0 || totalUpcomingMatchups > 0 || json.snapshotFound === true,
    totalStoredMatchups,
    totalUpcomingMatchups,
    storedCompetitions: Array.isArray(json.storedCompetitions) ? json.storedCompetitions : [],
    suggestedCompetitionId,
    resolvedCompetitionId
  };
}

export async function fetchDifficultMarkingDetail(matchupId: string): Promise<DifficultMarkingMatchup | null> {
  const res = await fetch(
    `${env.apiUrl}/api/mobile/difficult-markings/${encodeURIComponent(matchupId)}`,
    {
      headers: await buildHeaders(),
      cache: "no-store"
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("difficult_marking_detail_failed");
  const json = (await res.json()) as { matchup?: DifficultMarkingMatchup };
  return json.matchup ?? null;
}
