import { env } from "@/lib/env";
import { buildMobileHeaders, fetchWithTimeout } from "@/lib/mobile-http";
import type {
  FantaDuelResult,
  FantaMatchupBriefing,
  FantaMatchupCard,
  FantaPlayerSearchHit,
  FantaRankingRow,
  FantaRoleGroup,
  FantaScoutPlayer,
  FantaTrendCategory,
  FantaTrendRow
} from "../../../lib/fanta/types";

async function fantaGet<T>(path: string, search: Record<string, string | undefined>): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value) params.set(key, value);
  }
  params.set("_", String(Date.now()));
  const res = await fetchWithTimeout(
    `${env.apiUrl}/api/mobile/fanta/${path}?${params.toString()}`,
    { headers: await buildMobileHeaders() },
    45_000
  );
  if (!res.ok) throw new Error(`fanta_${path}_failed`);
  return res.json() as Promise<T>;
}

export async function fetchFantaSearch(params: {
  competitionId: string;
  query: string;
  locale: string;
}): Promise<{ results: FantaPlayerSearchHit[] }> {
  return fantaGet("search", {
    competitionId: params.competitionId,
    q: params.query,
    locale: params.locale
  });
}

export async function fetchFantaScout(params: {
  competitionId: string;
  playerId: string;
  locale: string;
}): Promise<{ player: FantaScoutPlayer }> {
  return fantaGet("scout", {
    competitionId: params.competitionId,
    playerId: params.playerId,
    locale: params.locale
  });
}

export async function fetchFantaRanking(params: {
  competitionId: string;
  role?: FantaRoleGroup | "all";
  locale: string;
}): Promise<{ rows: FantaRankingRow[]; updatedAt: string | null }> {
  return fantaGet("ranking", {
    competitionId: params.competitionId,
    role: params.role,
    locale: params.locale
  });
}

export async function fetchFantaTrends(params: {
  competitionId: string;
  category: FantaTrendCategory;
  locale: string;
}): Promise<{ rows: FantaTrendRow[]; updatedAt: string | null }> {
  return fantaGet("trends", {
    competitionId: params.competitionId,
    category: params.category,
    locale: params.locale
  });
}

export async function fetchFantaMatchups(params: {
  competitionId: string;
  locale: string;
}): Promise<{ briefing: FantaMatchupBriefing; results: FantaMatchupCard[]; updatedAt: string | null }> {
  return fantaGet("matchups", {
    competitionId: params.competitionId,
    locale: params.locale
  });
}

export async function fetchFantaMatchupDetail(params: {
  competitionId: string;
  matchupId: string;
  locale: string;
}): Promise<{ matchup: FantaMatchupCard }> {
  return fantaGet(`matchups/${encodeURIComponent(params.matchupId)}`, {
    competitionId: params.competitionId,
    locale: params.locale
  });
}

export async function fetchFantaDuel(params: {
  competitionId: string;
  locale: string;
  playerAId: string;
  playerBId: string;
}): Promise<FantaDuelResult> {
  const search = new URLSearchParams({
    competitionId: params.competitionId,
    locale: params.locale,
    playerAId: params.playerAId,
    playerBId: params.playerBId,
    _: String(Date.now())
  });
  const res = await fetchWithTimeout(`${env.apiUrl}/api/mobile/fanta/lineup?${search.toString()}`, {
    headers: await buildMobileHeaders()
  }, 45_000);
  const payload = (await res.json()) as FantaDuelResult & { error?: string; message?: string };
  if (!res.ok || payload.error) {
    const err = new Error(payload.message || payload.error || "fanta_duel_failed");
    (err as Error & { code?: string }).code = payload.error;
    throw err;
  }
  return payload;
}
