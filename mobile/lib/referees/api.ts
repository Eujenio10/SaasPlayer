import { env } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/mobile-http";
import type { RefereeSeverityRoundResponse } from "@/lib/referees/types";

export async function fetchRefereeSeverity(params: {
  competitionId?: string;
  token?: string | null;
  refresh?: boolean;
}): Promise<RefereeSeverityRoundResponse> {
  const search = new URLSearchParams();
  if (params.competitionId) search.set("competitionId", params.competitionId);
  if (params.refresh) search.set("refresh", "1");

  const res = await fetchWithTimeout(
    `${env.apiUrl}/api/mobile/referee-severity?${search.toString()}`,
    {
      headers: {
        "X-PitchBrain-Client": "mobile",
        ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
      }
    },
    90_000
  );
  if (!res.ok) throw new Error("referee_severity_fetch_failed");
  return res.json() as Promise<RefereeSeverityRoundResponse>;
}
