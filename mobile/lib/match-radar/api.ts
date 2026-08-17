import { env } from "@/lib/env";
import type { MatchRadarApiResponse } from "@/lib/match-radar/api-handlers";
import type { MatchRadarMode } from "@/lib/match-radar/config";

export async function fetchMatchRadar(params: {
  mode?: MatchRadarMode;
  date?: string;
  competitionId?: string;
  locale?: "it" | "en";
  token?: string | null;
}): Promise<MatchRadarApiResponse> {
  const search = new URLSearchParams();
  if (params.mode) search.set("mode", params.mode);
  if (params.date) search.set("date", params.date);
  if (params.competitionId) search.set("competitionId", params.competitionId);
  if (params.locale) search.set("locale", params.locale);

  const res = await fetch(`${env.apiUrl}/api/mobile/match-radar?${search.toString()}`, {
    headers: {
      "X-PitchBrain-Client": "mobile",
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
    }
  });
  if (!res.ok) throw new Error("match_radar_fetch_failed");
  return res.json() as Promise<MatchRadarApiResponse>;
}

export async function fetchMatchRadarDetail(params: {
  matchId: string;
  locale?: "it" | "en";
  token?: string | null;
}): Promise<{ detail: import("@/lib/match-radar/types").MatchRadarDetailResponse }> {
  const search = new URLSearchParams();
  if (params.locale) search.set("locale", params.locale);

  const res = await fetch(
    `${env.apiUrl}/api/mobile/match-radar/${encodeURIComponent(params.matchId)}?${search.toString()}`,
    {
      headers: {
        "X-PitchBrain-Client": "mobile",
        ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
      }
    }
  );
  if (!res.ok) throw new Error("match_radar_detail_fetch_failed");
  return res.json() as Promise<{ detail: import("@/lib/match-radar/types").MatchRadarDetailResponse }>;
}
