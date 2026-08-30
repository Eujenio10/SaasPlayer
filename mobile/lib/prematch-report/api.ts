import { localizePreMatchReport } from "@/lib/prematch-report/localize";
import { env } from "@/lib/env";
import { buildMobileHeaders, fetchWithTimeout } from "@/lib/mobile-http";
import type { PreMatchReport, PreMatchReportResponse } from "@/lib/prematch-report/types";

const memoryCache = new Map<number, { report: PreMatchReport; fetchedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function buildHeaders(): Promise<HeadersInit> {
  return buildMobileHeaders();
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
  const headers = await buildHeaders();
  const res = await fetchWithTimeout(
    `${env.apiUrl}/api/mobile/pre-match-report?eventId=${encodeURIComponent(String(eventId))}${refresh}`,
    { headers },
    22_000
  );

  const text = await res.text();
  let body: PreMatchReportResponse & { error?: string; message?: string };
  try {
    body = text.trim()
      ? (JSON.parse(text) as PreMatchReportResponse & { error?: string; message?: string })
      : ({} as PreMatchReportResponse & { error?: string; message?: string });
  } catch {
    throw new Error("empty_report");
  }

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
