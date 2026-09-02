import { env } from "@/lib/env";
import {
  localizeTacticalMetrics,
  localizeUpcomingMatches,
  translateCompetitionName,
  translateTeamName
} from "@/lib/italian-display";
import { buildMobileHeaders, fetchWithTimeout, USER_API_TIMEOUT_MS } from "@/lib/mobile-http";
import type { HomeDashboardData } from "@/lib/home-dashboard/types";
import type {
  MatchIntensityPreview,
  TacticalMetrics,
  UpcomingMatchItem,
  UserAccessSummary,
  YellowCardRiskPlayer
} from "@/lib/types";

const MATCHES_MENU_CACHE_MS = 25_000;
let matchesMenuCache: {
  at: number;
  data: { matches: UpcomingMatchItem[]; total: number };
} | null = null;

export function invalidateMatchesCache(): void {
  matchesMenuCache = null;
}

async function buildHeaders(requireAuth = false): Promise<HeadersInit> {
  return buildMobileHeaders(requireAuth);
}



async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text.trim()) {
    throw new Error(`empty_response_${res.status}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`invalid_json_${res.status}`);
  }
}

async function apiFetchOnce<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const headers = await buildHeaders(requireAuth);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${env.apiUrl}${path}`,
      {
        ...init,
        headers: {
          ...headers,
          ...(init?.headers ?? {})
        }
      },
      init?.signal != null ? 5 * 60 * 1000 : USER_API_TIMEOUT_MS
    );
  } catch (error) {
    throw mapFetchTransportError(error, path);
  }

  if (!res.ok) {
    const body = await parseJsonResponse<{ error?: string; message?: string }>(res).catch(
      () => ({}) as { error?: string; message?: string }
    );
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `request_failed_${res.status}`;
    throw new Error(message);
  }

  return parseJsonResponse<T>(res);
}

function isRetryableFetchError(error: unknown): boolean {
  if (isAbortFetchError(error)) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("connessione lenta") ||
    msg.includes("request_failed_503") ||
    msg.includes("request_failed_429") ||
    msg.includes("request_failed_502") ||
    msg.includes("request_failed_504")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const method = String(init?.method ?? "GET").toUpperCase();
  const attempts = method === "GET" && init?.signal == null ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await apiFetchOnce<T>(path, init, requireAuth);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && isRetryableFetchError(error)) {
        await sleep(500);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isAbortFetchError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const candidate = error as { name?: string; message?: string };
    if (candidate.name === "AbortError") return true;
    if (typeof candidate.message === "string") {
      const msg = candidate.message.toLowerCase();
      if (msg === "aborted" || msg === "timeout") return true;
    }
  }
  return false;
}

function mapFetchTransportError(error: unknown, path?: string): Error {
  if (isAbortFetchError(error)) {
    const catalog =
      !path ||
      path.includes("/matches") ||
      path.includes("home-dashboard") ||
      path.includes("yellow-card");
    return new Error(
      catalog
        ? "Connessione lenta. Il calendario è già in archivio: riprova tra qualche secondo."
        : "Connessione lenta. Riprova tra qualche secondo."
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}



export async function fetchUserAccess(): Promise<UserAccessSummary> {

  return apiFetch<UserAccessSummary>("/api/user/access", undefined, true);

}

/** Eliminazione definitiva account (App Store guideline 5.1.1). */
export async function deleteUserAccount(): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    "/api/mobile/user/delete-account",
    {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE" })
    },
    true
  );
}

/** Invito registrazione: email con link per impostare la password. */
export async function requestSignUp(
  email: string,
  locale?: string
): Promise<{
  ok: boolean;
  alreadyRegistered: boolean;
  resent?: boolean;
  message: string;
}> {
  return apiFetch("/api/mobile/auth/request-signup", {
    method: "POST",
    body: JSON.stringify({ email, locale })
  });
}

export async function requestPasswordReset(
  email: string,
  locale?: string
): Promise<{ ok: boolean; message: string }> {
  return apiFetch("/api/mobile/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, locale })
  });
}



export async function fetchHomeDashboard(): Promise<HomeDashboardData> {

  const data = await apiFetch<HomeDashboardData>("/api/mobile/home-dashboard");

  return {

    ...data,

    featuredMatch: data.featuredMatch

      ? {

          ...data.featuredMatch,

          competitionName: translateCompetitionName(data.featuredMatch.competitionName),

          homeTeamName: translateTeamName(data.featuredMatch.homeTeamName),

          awayTeamName: translateTeamName(data.featuredMatch.awayTeamName),

          homeTeamShortName: translateTeamName(data.featuredMatch.homeTeamShortName),

          awayTeamShortName: translateTeamName(data.featuredMatch.awayTeamShortName)

        }

      : null

  };

}



export type AdminRefreshPhaseResult = {
  ok: boolean;
  done: boolean;
  phase: "start" | "insights" | "finalize";
  nextPhase?: "start" | "insights" | "finalize";
  nextInsightsOffset?: number;
  insightsSnap?: number;
  matchesCount: number;
  domesticMatchesCount: number;
  internationalMatchesCount: number;
  internationalDiscoveryCount?: number;
  insightsProcessed: number;
  insightsTotal: number;
  topFiveInsightsTotal: number;
  worldCupInsightsTotal: number;
  insightsPartial?: boolean;
  trendsCount?: number;
  markingsCount?: number;
  error?: string;
};

/**
 * Refresh admin a fasi (anti-504 Hobby): start → insights (batch) → finalize.
 * Esegue più richieste finché `done` non è true.
 */
export async function refreshAdminMatches(
  onProgress?: (progress: { current: number; total: number; phase: string }) => void,
  competitionSlug?: string
): Promise<AdminRefreshPhaseResult> {
  let phase: "start" | "insights" | "finalize" = "start";
  let insightsOffset = 0;
  let insightsSnap: number | undefined;
  let insightsSucceeded = 0;
  let last: AdminRefreshPhaseResult | null = null;
  let guard = 0;

  while (guard < 250) {
    guard += 1;
    const controller = new AbortController();
    /** Vicino al maxDuration serverless (300s): una singola partita con molti giocatori
     * e retry sui 429 può richiedere diversi minuti. */
    const timeout = setTimeout(() => controller.abort(), 4.6 * 60 * 1000);
    try {
      const result = await apiFetch<AdminRefreshPhaseResult>(
        "/api/tactical/admin-refresh-matches",
        {
          method: "POST",
          body: JSON.stringify({
            phase,
            insightsOffset,
            insightsSnap,
            competitionSlug: competitionSlug || undefined
          }),
          signal: controller.signal
        },
        true
      );
      last = result;
      if (!result.ok) {
        throw new Error(result.error ?? "refresh_failed");
      }
      if (typeof result.insightsSnap === "number") {
        insightsSnap = result.insightsSnap;
      }
      if (phase === "insights") {
        insightsSucceeded += result.insightsProcessed ?? 0;
      }
      const current =
        typeof result.nextInsightsOffset === "number"
          ? result.nextInsightsOffset
          : phase === "finalize"
            ? result.insightsTotal
            : insightsSucceeded;
      onProgress?.({
        current,
        total: result.insightsTotal ?? 0,
        phase: result.phase
      });

      if (result.done) {
        return {
          ...result,
          insightsProcessed: Math.max(insightsSucceeded, result.insightsProcessed ?? 0)
        };
      }

      phase = result.nextPhase ?? "finalize";
      insightsOffset = result.nextInsightsOffset ?? insightsOffset;
    } catch (error) {
      throw mapFetchTransportError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!last) {
    throw new Error("refresh_failed");
  }
  return {
    ...last,
    insightsProcessed: insightsSucceeded,
    insightsPartial: true
  };
}



export async function fetchMatches(): Promise<{
  matches: UpcomingMatchItem[];
  total: number;
}> {
  const now = Date.now();
  if (matchesMenuCache && now - matchesMenuCache.at < MATCHES_MENU_CACHE_MS) {
    return matchesMenuCache.data;
  }

  const data = await apiFetch<{ matches: UpcomingMatchItem[]; total: number }>(
    "/api/tactical/matches"
  );
  const localized = {
    ...data,
    matches: localizeUpcomingMatches(data.matches ?? [])
  };
  matchesMenuCache = { at: Date.now(), data: localized };
  return localized;
}

export async function fetchIntensityPreviews(
  eventIds: number[]
): Promise<Record<string, MatchIntensityPreview>> {
  const unique = [
    ...new Set(eventIds.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id)))
  ];
  if (!unique.length) return {};

  const merged: Record<string, MatchIntensityPreview> = {};
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const data = await apiFetch<{ previews?: Record<string, MatchIntensityPreview> }>(
        `/api/tactical/match-intensity-previews?eventIds=${encodeURIComponent(chunk.join(","))}`
      );
      Object.assign(merged, data.previews ?? {});
    } catch {
      // backend senza endpoint o rete: il menu resta visibile
    }
  }
  return merged;
}

export async function fetchMatchInsights(

  eventId: number,

  options?: { refresh?: boolean }

): Promise<{

  metrics: TacticalMetrics[];

  playerDetailLevel: string;

  insightsSnap: number;

}> {

  const refresh = options?.refresh ? "&refresh=1" : "";

  const data = await apiFetch<{

    metrics: TacticalMetrics[];

    playerDetailLevel: string;

    insightsSnap: number;

  }>(

    `/api/tactical/org-kiosk-match-insights?eventId=${encodeURIComponent(String(eventId))}${refresh}`

  );

  return {

    ...data,

    metrics: localizeTacticalMetrics(data.metrics ?? [])

  };

}



export async function consumeMemberMatch(eventId: number): Promise<void> {

  await apiFetch("/api/tactical/member-match-week-consume", {

    method: "POST",

    body: JSON.stringify({ eventId })

  }, true);

}



export async function fetchYellowCardSnapshot(): Promise<{

  rows: YellowCardRiskPlayer[];

  matches: UpcomingMatchItem[];

}> {

  return apiFetch("/api/tactical/org-yellow-card-snapshot", undefined, true);

}



export async function updateProfileName(fullName: string): Promise<void> {

  await apiFetch("/api/user/profile", {

    method: "PATCH",

    body: JSON.stringify({ fullName })

  }, true);

}


