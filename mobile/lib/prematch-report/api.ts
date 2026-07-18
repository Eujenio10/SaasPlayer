import { localizePreMatchReport } from "@/lib/prematch-report/localize";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { PreMatchReport, PreMatchReportResponse } from "@/lib/prematch-report/types";

const memoryCache = new Map<number, { report: PreMatchReport; fetchedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("not_authenticated");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export async function fetchPreMatchReport(
  eventId: number,
  options?: { refresh?: boolean }
): Promise<PreMatchReport> {
  if (!options?.refresh) {
    const cached = memoryCache.get(eventId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.report;
    }
  }

  const refresh = options?.refresh ? "&refresh=1" : "";
  const headers = await authHeaders();
  const res = await fetch(
    `${env.apiUrl}/api/mobile/pre-match-report?eventId=${encodeURIComponent(String(eventId))}${refresh}`,
    { headers }
  );

  const text = await res.text();
  const body = text.trim()
    ? (JSON.parse(text) as PreMatchReportResponse & { error?: string; message?: string })
    : ({} as PreMatchReportResponse & { error?: string; message?: string });

  if (!res.ok) {
    const code = typeof body.error === "string" ? body.error : `request_failed_${res.status}`;
    const err = new Error(code);
    if (typeof body.message === "string") {
      (err as Error & { userMessage?: string }).userMessage = body.message;
    }
    throw err;
  }

  if (!body.report) throw new Error("empty_report");
  const report = localizePreMatchReport(body.report);
  memoryCache.set(eventId, { report, fetchedAt: Date.now() });
  return report;
}

export function clearPreMatchReportCache(eventId?: number): void {
  if (eventId != null) memoryCache.delete(eventId);
  else memoryCache.clear();
}
