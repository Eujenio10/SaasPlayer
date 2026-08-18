import { DATA_REFRESH_CONFIG } from "@/lib/data-refresh/config";
import { morningRefreshProgressLabel } from "@/lib/data-refresh/morning-job";
import {
  computeNextDailyRefreshAt,
  formatLastRefreshItalian,
  romeDateKeyNow
} from "@/lib/data-refresh/schedule";
import { getLastDataRefreshAt, getMorningRefreshJob } from "@/lib/data-refresh/state";

export interface DataRefreshStatus {
  timezone: string;
  scheduleHour: number;
  scheduleLabel: string;
  scheduleDetail: string;
  nextScheduledAt: string;
  lastRefreshAt: string | null;
  lastRefreshLabel: string | null;
  automatedDailyRefresh: true;
  inProgress: boolean;
  currentCompetitionLabel: string | null;
}

export async function buildDataRefreshStatus(organizationId: string): Promise<DataRefreshStatus> {
  const [lastRefreshAt, job] = await Promise.all([
    getLastDataRefreshAt(organizationId),
    getMorningRefreshJob(organizationId)
  ]);
  const inProgress = Boolean(job && job.dateKey === romeDateKeyNow() && job.status === "running");

  return {
    timezone: DATA_REFRESH_CONFIG.timezone,
    scheduleHour: DATA_REFRESH_CONFIG.hour,
    scheduleLabel: DATA_REFRESH_CONFIG.scheduleLabel,
    scheduleDetail: "un campionato dopo l'altro",
    nextScheduledAt: inProgress ? new Date().toISOString() : computeNextDailyRefreshAt(),
    lastRefreshAt,
    lastRefreshLabel: lastRefreshAt ? formatLastRefreshItalian(lastRefreshAt) : null,
    automatedDailyRefresh: true,
    inProgress,
    currentCompetitionLabel: inProgress ? morningRefreshProgressLabel(job) : null
  };
}
