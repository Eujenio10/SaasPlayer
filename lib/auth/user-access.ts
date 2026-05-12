import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UserAccessRole } from "@/lib/auth/organization";

export const MEMBER_WEEKLY_MATCH_LIMIT = 3;

export interface WeeklyMatchUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  eventIds: number[];
  weekStartsAt: string;
}

export interface UserAccessSummary {
  role: UserAccessRole;
  isAdmin: boolean;
  isPro: boolean;
  isMember: boolean;
  canRefreshData: boolean;
  matchUsage: WeeklyMatchUsage;
  yellowCardVisibleRows: number | null;
}

function weekStartUtc(date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function currentWeekStartsAtIso(): string {
  return weekStartUtc().toISOString();
}

/** Intervallo [start, end) in UTC per la "settimana" di conteggio (lunedì 00:00 UTC). */
function getUtcWeekWindow(now = new Date()): { start: Date; end: Date } {
  const start = weekStartUtc(now);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function buildUnlimitedMatchUsage(): WeeklyMatchUsage {
  return {
    used: 0,
    limit: null,
    remaining: null,
    eventIds: [],
    weekStartsAt: currentWeekStartsAtIso()
  };
}

async function getMemberWeeklyMatchUsageInWindow(
  userId: string,
  window: { start: Date; end: Date }
): Promise<WeeklyMatchUsage> {
  const supabase = createSupabaseServiceClient();
  const startIso = window.start.toISOString();
  const endIso = window.end.toISOString();
  const { data } = await supabase
    .from("member_match_usage")
    .select("event_id")
    .eq("user_id", userId)
    .gte("week_starts_at", startIso)
    .lt("week_starts_at", endIso);

  const eventIds = Array.from(
    new Set((data ?? []).map((row) => Number(row.event_id)).filter((id) => Number.isFinite(id)))
  );

  return {
    used: eventIds.length,
    limit: MEMBER_WEEKLY_MATCH_LIMIT,
    remaining: Math.max(0, MEMBER_WEEKLY_MATCH_LIMIT - eventIds.length),
    eventIds,
    weekStartsAt: startIso
  };
}

export async function getMemberWeeklyMatchUsage(userId: string): Promise<WeeklyMatchUsage> {
  return getMemberWeeklyMatchUsageInWindow(userId, getUtcWeekWindow());
}

export async function ensureMemberCanAnalyzeMatch(userId: string, eventId: number): Promise<WeeklyMatchUsage> {
  const window = getUtcWeekWindow();
  const current = await getMemberWeeklyMatchUsageInWindow(userId, window);
  if (current.eventIds.includes(eventId)) return current;
  if (current.used >= MEMBER_WEEKLY_MATCH_LIMIT) {
    throw new Error("member_weekly_match_limit_reached");
  }

  const supabase = createSupabaseServiceClient();
  const weekStartsAtValue = window.start.toISOString();
  const { error } = await supabase.from("member_match_usage").insert({
    user_id: userId,
    event_id: eventId,
    week_starts_at: weekStartsAtValue
  });
  /** Race: due richieste parallele sulla stessa partita possono generare 23505. */
  if (error && String(error.code) !== "23505") {
    throw error;
  }

  return getMemberWeeklyMatchUsageInWindow(userId, window);
}

export async function buildUserAccessSummary(
  userId: string,
  role: UserAccessRole
): Promise<UserAccessSummary> {
  const isAdmin = role === "admin";
  const isPro = role === "pro";
  const isMember = role === "member";
  const matchUsage = appliesWeeklyMatchQuota(role)
    ? await getMemberWeeklyMatchUsage(userId)
    : buildUnlimitedMatchUsage();

  return {
    role,
    isAdmin,
    isPro,
    isMember,
    canRefreshData: isAdmin,
    matchUsage,
    yellowCardVisibleRows: appliesWeeklyMatchQuota(role) ? 3 : null
  };
}

/** Allineato alla quota in `match-insights`: solo ruolo membro (incluso legacy normalizzato da `viewer`). */
export function appliesWeeklyMatchQuota(role: UserAccessRole): boolean {
  return role === "member";
}
