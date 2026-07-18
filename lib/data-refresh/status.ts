import { DATA_REFRESH_CONFIG } from "@/lib/data-refresh/config";
import {
  computeNextDailyRefreshAt,
  formatLastRefreshItalian
} from "@/lib/data-refresh/schedule";
import { getLastDataRefreshAt } from "@/lib/data-refresh/state";

export interface DataRefreshStatus {
  timezone: string;
  scheduleHour: number;
  scheduleLabel: string;
  nextScheduledAt: string;
  lastRefreshAt: string | null;
  lastRefreshLabel: string | null;
  automatedDailyRefresh: true;
}

export async function buildDataRefreshStatus(organizationId: string): Promise<DataRefreshStatus> {
  const lastRefreshAt = await getLastDataRefreshAt(organizationId);

  return {
    timezone: DATA_REFRESH_CONFIG.timezone,
    scheduleHour: DATA_REFRESH_CONFIG.hour,
    scheduleLabel: DATA_REFRESH_CONFIG.scheduleLabel,
    nextScheduledAt: computeNextDailyRefreshAt(),
    lastRefreshAt,
    lastRefreshLabel: lastRefreshAt ? formatLastRefreshItalian(lastRefreshAt) : null,
    automatedDailyRefresh: true
  };
}
