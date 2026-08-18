import { DATA_REFRESH_CONFIG } from "@/lib/data-refresh/config";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(fmt.formatToParts(date).find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let ts = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = zonedParts(new Date(ts), timeZone);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const diff = desiredMs - actualMs;
    ts += diff;
    if (Math.abs(diff) < 1000) break;
  }
  return new Date(ts);
}

function addDaysInTimeZone(
  year: number,
  month: number,
  day: number,
  days: number,
  timeZone: string
): Pick<ZonedParts, "year" | "month" | "day"> {
  const midday = zonedLocalToUtc(year, month, day, 12, 0, timeZone);
  return zonedParts(new Date(midday.getTime() + days * 24 * 60 * 60 * 1000), timeZone);
}

export function computeNextDailyRefreshAt(now = new Date()): string {
  const { timezone, hour, minute } = DATA_REFRESH_CONFIG;
  const current = zonedParts(now, timezone);
  const passedToday =
    current.hour > hour || (current.hour === hour && current.minute >= minute);

  let targetYear = current.year;
  let targetMonth = current.month;
  let targetDay = current.day;

  if (passedToday) {
    const tomorrow = addDaysInTimeZone(current.year, current.month, current.day, 1, timezone);
    targetYear = tomorrow.year;
    targetMonth = tomorrow.month;
    targetDay = tomorrow.day;
  }

  return zonedLocalToUtc(targetYear, targetMonth, targetDay, hour, minute, timezone).toISOString();
}

export function msUntilIso(targetIso: string, nowMs = Date.now()): number {
  return Math.max(0, new Date(targetIso).getTime() - nowMs);
}

export function formatCountdownItalian(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds <= 0) return "in corso";
  if (totalSeconds < 60) return `tra ${totalSeconds} ${totalSeconds === 1 ? "secondo" : "secondi"}`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours <= 0) {
    return `tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}`;
  }
  if (minutes <= 0) {
    return `tra ${hours} ${hours === 1 ? "ora" : "ore"}`;
  }
  return `tra ${hours} ${hours === 1 ? "ora" : "ore"} e ${minutes} ${minutes === 1 ? "minuto" : "minuti"}`;
}

export function formatLastRefreshItalian(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: DATA_REFRESH_CONFIG.timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function romeDateKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DATA_REFRESH_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

export function romeDateKeyNow(now = new Date()): string {
  return romeDateKeyFromIso(now.toISOString());
}

export function isAfterOrAtDailyRefreshStart(now = new Date()): boolean {
  const { timezone, hour, minute } = DATA_REFRESH_CONFIG;
  const current = zonedParts(now, timezone);
  return current.hour > hour || (current.hour === hour && current.minute >= minute);
}

export function isBeforeMorningRefreshHardStop(now = new Date()): boolean {
  const { timezone, continuationEndHour } = DATA_REFRESH_CONFIG;
  const current = zonedParts(now, timezone);
  return current.hour < continuationEndHour;
}

/**
 * Finestra in cui il cron Vercel può *avviare* il giro mattutino
 * (dalle 05:00, con un margine per ritardi dello scheduler).
 */
export function isWithinDailyRefreshWindow(now = new Date()): boolean {
  const { timezone, hour } = DATA_REFRESH_CONFIG;
  const current = zonedParts(now, timezone);
  return current.hour === hour && current.minute < 40;
}
