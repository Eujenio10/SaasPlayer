import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import {
  localizeTacticalMetrics,
  localizeUpcomingMatches,
  translateCompetitionName,
  translateTeamName
} from "@/lib/italian-display";
import { supabase } from "@/lib/supabase";
import type { HomeDashboardData } from "@/lib/home-dashboard/types";
import type {
  TacticalMetrics,
  UpcomingMatchItem,
  UserAccessSummary,
  YellowCardRiskPlayer
} from "@/lib/types";

async function buildHeaders(requireAuth = false): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId()
  ]);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId
  };

  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (requireAuth) {
    throw new Error("not_authenticated");
  }

  return headers;
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

const DEFAULT_API_TIMEOUT_MS = 25_000;

/** React Native / Hermes non espone AbortSignal.timeout — polyfill con AbortController. */
function createFetchTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer)
  };
}

async function apiFetch<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const headers = await buildHeaders(requireAuth);

  const timeout =
    init?.signal != null
      ? null
      : createFetchTimeoutSignal(DEFAULT_API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers ?? {})
      },
      signal: init?.signal ?? timeout?.signal
    });
  } catch (error) {
    throw mapFetchTransportError(error);
  } finally {
    timeout?.cancel();
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

function isAbortFetchError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const candidate = error as { name?: string; message?: string };
    if (candidate.name === "AbortError") return true;
    if (typeof candidate.message === "string" && candidate.message.toLowerCase() === "aborted") {
      return true;
    }
  }
  return false;
}

function mapFetchTransportError(error: unknown): Error {
  if (isAbortFetchError(error)) {
    return new Error(
      "Operazione troppo lunga (timeout). Menu e statistiche potrebbero essere comunque in aggiornamento: attendi qualche minuto e ricarica."
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
export async function requestSignUp(email: string): Promise<{
  ok: boolean;
  alreadyRegistered: boolean;
  resent?: boolean;
  message: string;
}> {
  return apiFetch("/api/mobile/auth/request-signup", {
    method: "POST",
    body: JSON.stringify({ email })
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
  onProgress?: (progress: { current: number; total: number; phase: string }) => void
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
            insightsSnap
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

  const data = await apiFetch<{ matches: UpcomingMatchItem[]; total: number }>("/api/tactical/matches");

  return {

    ...data,

    matches: localizeUpcomingMatches(data.matches ?? [])

  };

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


