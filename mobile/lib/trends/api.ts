import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { supabase } from "@/lib/supabase";
import type { PlayerTrend, TrendsResponse } from "./types";

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

export async function fetchTrends(params: {
  competitionId: string;
  round?: string;
  metric?: "all" | "shots" | "shots_on_target" | "saves";
  reliability?: "all" | "high" | "medium_high";
}): Promise<
  TrendsResponse & {
    updatedAt: string | null;
    availableRounds: string[];
    trendDatabaseReady?: boolean;
    storedCompetitions?: string[];
    suggestedCompetitionId?: string | null;
    resolvedCompetitionId?: string;
    totalStoredTrends?: number;
  }
> {
  const search = new URLSearchParams({ competitionId: params.competitionId });
  if (params.round) search.set("round", params.round);
  if (params.metric) search.set("metric", params.metric);
  if (params.reliability) search.set("reliability", params.reliability);
  search.set("_", String(Date.now()));

  const res = await fetch(`${env.apiUrl}/api/mobile/trends?${search.toString()}`, {
    headers: await buildHeaders(),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("trends_fetch_failed");
  return res.json();
}

export async function fetchTrendDetail(trendId: string): Promise<{ trend: PlayerTrend | null }> {
  const res = await fetch(`${env.apiUrl}/api/mobile/trends/${encodeURIComponent(trendId)}`, {
    headers: await buildHeaders(),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("trend_detail_fetch_failed");
  return res.json();
}
