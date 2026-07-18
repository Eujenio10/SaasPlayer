export const DATA_REFRESH_CONFIG = {
  timezone: "Europe/Rome",
  hour: 8,
  minute: 0,
  scheduleLabel: "08:00"
} as const;

export type DataRefreshTrigger = "admin_manual" | "scheduled_cron";
