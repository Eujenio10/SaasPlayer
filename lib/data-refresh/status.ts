import { formatMonitoredCompetitionLabel } from "@/lib/competitions";
import { DATA_REFRESH_CONFIG } from "@/lib/data-refresh/config";
import {
  isMorningJobFreshRunning,
  morningRefreshProgressLabel,
  morningRefreshSlugs
} from "@/lib/data-refresh/morning-job";
import {
  computeNextDailyRefreshAt,
  computeSlotAtHourToday,
  formatLastRefreshItalian,
  isWithinDailyRefreshWindow,
  romeDateKeyNow,
  romeHourNow
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
  pendingStart: boolean;
  currentCompetitionLabel: string | null;
}

export async function buildDataRefreshStatus(organizationId: string): Promise<DataRefreshStatus> {
  const [lastRefreshAt, job] = await Promise.all([
    getLastDataRefreshAt(organizationId),
    getMorningRefreshJob(organizationId)
  ]);
  const todayKey = romeDateKeyNow();
  const inProgress = isMorningJobFreshRunning(job, todayKey);
  const doneToday = Boolean(job && job.dateKey === todayKey && job.status === "done");
  const waitingToday = Boolean(job && job.dateKey === todayKey && job.status === "waiting");
  const holdHour = job?.holdUntilHour ?? DATA_REFRESH_CONFIG.hour;
  const pendingStart =
    !inProgress &&
    !doneToday &&
    (isWithinDailyRefreshWindow() || (waitingToday && romeHourNow() >= holdHour));

  let nextScheduledAt = computeNextDailyRefreshAt();
  if (inProgress || pendingStart) {
    nextScheduledAt = new Date().toISOString();
  } else if (waitingToday) {
    nextScheduledAt = computeSlotAtHourToday(holdHour);
  }

  let currentCompetitionLabel = inProgress ? morningRefreshProgressLabel(job) : null;
  if (!currentCompetitionLabel && waitingToday && job) {
    const slug = morningRefreshSlugs()[job.competitionIndex];
    currentCompetitionLabel = slug ? formatMonitoredCompetitionLabel(slug) || slug : null;
  }

  return {
    timezone: DATA_REFRESH_CONFIG.timezone,
    scheduleHour: DATA_REFRESH_CONFIG.hour,
    scheduleLabel: DATA_REFRESH_CONFIG.scheduleLabel,
    scheduleDetail:
      "un campionato all'ora, finché tutti non sono stati aggiornati almeno una volta",
    nextScheduledAt,
    lastRefreshAt,
    lastRefreshLabel: lastRefreshAt ? formatLastRefreshItalian(lastRefreshAt) : null,
    automatedDailyRefresh: true,
    inProgress,
    pendingStart,
    currentCompetitionLabel
  };
}
