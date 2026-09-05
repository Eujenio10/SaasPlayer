/** Allineare la versione se cambia il payload del report pre-partita. */
export const PRE_MATCH_REPORT_CACHE_VERSION = "v9";

export function buildPreMatchReportCacheKey(organizationId: string, eventId: number): string {
  return `prematch_report:${PRE_MATCH_REPORT_CACHE_VERSION}:${organizationId}:${eventId}`;
}
