import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { ENTITLEMENT_FLAGS } from "@/lib/entitlements/config";
import { romeCalendarDateKey } from "@/lib/entitlements/rome-day";
import type { MatchUnlock, MatchUnlockSource } from "@/lib/entitlements/types";
import { isSubscriptionOperational } from "@/lib/subscription-policy";

let cachedTablesAvailable: boolean | undefined;
let cachedTablesAt = 0;
const TABLES_TTL_MS = 60_000;

function isMissingTableError(message: string): boolean {
  return message.includes("Could not find the table") || message.includes("does not exist");
}

export async function areEntitlementTablesAvailable(): Promise<boolean> {
  const now = Date.now();
  if (cachedTablesAvailable !== undefined && now - cachedTablesAt < TABLES_TTL_MS) {
    return cachedTablesAvailable;
  }
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("entitlement_match_unlocks").select("match_id").limit(1);
  if (!error) cachedTablesAvailable = true;
  else if (isMissingTableError(error.message)) cachedTablesAvailable = false;
  else {
    cachedTablesAvailable = false;
    console.warn("[entitlements] tables_probe_failed", { message: error.message });
  }
  cachedTablesAt = now;
  return cachedTablesAvailable;
}

function mapUnlockRows(
  data: Array<{
    match_id?: unknown;
    unlocked_at?: unknown;
    expires_at?: unknown;
    source?: unknown;
  }>
): MatchUnlock[] {
  const now = Date.now();
  return data
    .map((row): MatchUnlock | null => {
      const matchId = String(row.match_id ?? "");
      if (!matchId) return null;
      const expiresAt = typeof row.expires_at === "string" ? row.expires_at : null;
      if (expiresAt) {
        const exp = Date.parse(expiresAt);
        if (Number.isFinite(exp) && exp <= now) return null;
      }
      return {
        matchId,
        unlockedAt: typeof row.unlocked_at === "string" ? row.unlocked_at : new Date().toISOString(),
        expiresAt,
        source: row.source === "pro" ? "pro" : "rewarded_ad"
      };
    })
    .filter((row): row is MatchUnlock => row != null);
}

export async function loadSubjectMatchUnlocks(subjectKey: string): Promise<MatchUnlock[]> {
  if (!(await areEntitlementTablesAvailable())) return [];
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("entitlement_match_unlocks")
    .select("match_id,unlocked_at,expires_at,source")
    .eq("subject_key", subjectKey)
    .order("unlocked_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    if (error) console.warn("[entitlements] unlocks_read_failed", { message: error.message });
    return [];
  }
  return mapUnlockRows(data);
}

/** @deprecated Prefer loadSubjectMatchUnlocks */
export async function loadUserMatchUnlocks(userId: string): Promise<MatchUnlock[]> {
  return loadSubjectMatchUnlocks(`user:${userId}`);
}

export async function loadSubjectRewardedCounter(subjectKey: string): Promise<{
  usageDate: string;
  unlocksUsed: number;
}> {
  const today = romeCalendarDateKey();
  if (!(await areEntitlementTablesAvailable())) {
    return { usageDate: today, unlocksUsed: 0 };
  }
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("entitlement_rewarded_counters")
    .select("usage_date,unlocks_used")
    .eq("subject_key", subjectKey)
    .maybeSingle();

  if (error || !data) {
    return { usageDate: today, unlocksUsed: 0 };
  }

  const usageDate = typeof data.usage_date === "string" ? data.usage_date.slice(0, 10) : today;
  if (usageDate !== today) {
    return { usageDate: today, unlocksUsed: 0 };
  }
  const unlocksUsed = Number(data.unlocks_used);
  return {
    usageDate: today,
    unlocksUsed: Number.isFinite(unlocksUsed) ? Math.max(0, unlocksUsed) : 0
  };
}

/** @deprecated Prefer loadSubjectRewardedCounter */
export async function loadRewardedCounter(userId: string) {
  return loadSubjectRewardedCounter(`user:${userId}`);
}

export async function upsertSubjectMatchUnlock(params: {
  subjectKey: string;
  matchId: number;
  source: MatchUnlockSource;
  expiresAt?: string | null;
}): Promise<{ ok: boolean; message?: string; unlock?: MatchUnlock }> {
  if (!(await areEntitlementTablesAvailable())) {
    return { ok: false, message: "entitlement_tables_missing" };
  }
  const unlockedAt = new Date().toISOString();
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("entitlement_match_unlocks").upsert(
    {
      subject_key: params.subjectKey,
      match_id: params.matchId,
      unlocked_at: unlockedAt,
      expires_at: params.expiresAt ?? null,
      source: params.source,
      updated_at: unlockedAt
    },
    { onConflict: "subject_key,match_id" }
  );
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    unlock: {
      matchId: String(params.matchId),
      unlockedAt,
      expiresAt: params.expiresAt ?? null,
      source: params.source
    }
  };
}

/** @deprecated Prefer upsertSubjectMatchUnlock */
export async function upsertMatchUnlock(params: {
  userId: string;
  matchId: number;
  source: MatchUnlockSource;
  expiresAt?: string | null;
}) {
  return upsertSubjectMatchUnlock({
    subjectKey: `user:${params.userId}`,
    matchId: params.matchId,
    source: params.source,
    expiresAt: params.expiresAt
  });
}

export async function incrementSubjectRewardedCounter(subjectKey: string): Promise<{
  ok: boolean;
  unlocksUsed: number;
  usageDate: string;
  message?: string;
}> {
  const today = romeCalendarDateKey();
  if (!(await areEntitlementTablesAvailable())) {
    return { ok: false, unlocksUsed: 0, usageDate: today, message: "entitlement_tables_missing" };
  }

  const current = await loadSubjectRewardedCounter(subjectKey);
  const nextUsed = current.unlocksUsed + 1;
  if (nextUsed > ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit) {
    return {
      ok: false,
      unlocksUsed: current.unlocksUsed,
      usageDate: today,
      message: "daily_limit_reached"
    };
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("entitlement_rewarded_counters").upsert(
    {
      subject_key: subjectKey,
      usage_date: today,
      unlocks_used: nextUsed,
      updated_at: new Date().toISOString()
    },
    { onConflict: "subject_key" }
  );
  if (error) {
    return { ok: false, unlocksUsed: current.unlocksUsed, usageDate: today, message: error.message };
  }
  return { ok: true, unlocksUsed: nextUsed, usageDate: today };
}

/** @deprecated Prefer incrementSubjectRewardedCounter */
export async function incrementRewardedCounter(userId: string) {
  return incrementSubjectRewardedCounter(`user:${userId}`);
}

export async function consumeRewardedAdReceipt(params: {
  transactionId: string;
  subjectKey: string;
  matchId: number;
}): Promise<{ ok: boolean; message?: string }> {
  if (!(await areEntitlementTablesAvailable())) {
    return { ok: false, message: "entitlement_tables_missing" };
  }
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("rewarded_ad_receipts")
    .select("transaction_id,subject_key,match_id,consumed_at")
    .eq("transaction_id", params.transactionId)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "receipt_not_found" };
  if (data.consumed_at) return { ok: false, message: "receipt_already_consumed" };
  if (data.subject_key !== params.subjectKey) {
    return { ok: false, message: "receipt_subject_mismatch" };
  }
  if (data.match_id != null && Number(data.match_id) !== params.matchId) {
    return { ok: false, message: "receipt_match_mismatch" };
  }

  const { error: updateError } = await sb
    .from("rewarded_ad_receipts")
    .update({
      consumed_at: new Date().toISOString(),
      match_id: params.matchId
    })
    .eq("transaction_id", params.transactionId)
    .is("consumed_at", null);

  if (updateError) return { ok: false, message: updateError.message };
  return { ok: true };
}

export async function insertRewardedAdReceipt(params: {
  transactionId: string;
  subjectKey: string;
  matchId?: number | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!(await areEntitlementTablesAvailable())) {
    return { ok: false, message: "entitlement_tables_missing" };
  }
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("rewarded_ad_receipts").upsert(
    {
      transaction_id: params.transactionId,
      subject_key: params.subjectKey,
      match_id: params.matchId ?? null,
      verified_at: new Date().toISOString(),
      provider: "admob"
    },
    { onConflict: "transaction_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadUserProSubscription(userId: string): Promise<{
  active: boolean;
  status: string;
  currentPeriodEnd: string | null;
}> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("user_pro_subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { active: false, status: "none", currentPeriodEnd: null };
  }

  const status = typeof data.status === "string" ? data.status : "none";
  const currentPeriodEnd =
    typeof data.current_period_end === "string" ? data.current_period_end : null;
  const active = isSubscriptionOperational({ status, currentPeriodEnd });
  return { active, status, currentPeriodEnd };
}

export async function upsertUserProSubscription(params: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status: string;
  currentPeriodEnd?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("user_pro_subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      status: params.status,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
