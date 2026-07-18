import type { UserAccessRole } from "@/lib/auth/organization";
import {
  emptyGuestEntitlements,
  isMatchUnlocked,
  isProUser,
  resolveSubscriptionTier
} from "@/lib/entitlements/access";
import { ENTITLEMENT_FLAGS } from "@/lib/entitlements/config";
import { romeCalendarDateKey } from "@/lib/entitlements/rome-day";
import {
  areEntitlementTablesAvailable,
  consumeRewardedAdReceipt,
  incrementSubjectRewardedCounter,
  loadSubjectMatchUnlocks,
  loadSubjectRewardedCounter,
  loadUserProSubscription,
  upsertSubjectMatchUnlock
} from "@/lib/entitlements/repository";
import { resolveSubjectKey } from "@/lib/entitlements/subject";
import type { UnlockMatchResult, UserEntitlements } from "@/lib/entitlements/types";
import { trackEntitlementEvent } from "@/lib/entitlements/analytics";

export async function buildUserEntitlements(params: {
  userId: string | null;
  deviceId?: string | null;
  role?: UserAccessRole | "guest" | null;
  isPro?: boolean;
  isAdmin?: boolean;
}): Promise<UserEntitlements> {
  let tier = resolveSubscriptionTier({
    role: params.role,
    isPro: params.isPro,
    isAdmin: params.isAdmin
  });

  if (params.userId && tier === "free") {
    const proSub = await loadUserProSubscription(params.userId);
    if (proSub.active) tier = "pro";
  }

  const subjectKey = resolveSubjectKey({
    userId: params.userId,
    deviceId: params.deviceId
  });

  if (!subjectKey) {
    return emptyGuestEntitlements();
  }

  if (isProUser(tier)) {
    return {
      userId: params.userId,
      subscriptionTier: "pro",
      rewardedUnlocksUsedToday: 0,
      rewardedUnlocksDate: romeCalendarDateKey(),
      rewardedUnlocksRemaining: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
      dailyRewardedUnlockLimit: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
      unlockedMatches: [],
      rewardedAdsEnabled: ENTITLEMENT_FLAGS.rewardedAdsEnabled
    };
  }

  const tablesReady = await areEntitlementTablesAvailable();
  if (!tablesReady) {
    return {
      userId: params.userId,
      subscriptionTier: "free",
      rewardedUnlocksUsedToday: 0,
      rewardedUnlocksDate: romeCalendarDateKey(),
      rewardedUnlocksRemaining: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
      dailyRewardedUnlockLimit: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
      unlockedMatches: [],
      rewardedAdsEnabled: ENTITLEMENT_FLAGS.rewardedAdsEnabled
    };
  }

  const [unlocks, counter] = await Promise.all([
    loadSubjectMatchUnlocks(subjectKey),
    loadSubjectRewardedCounter(subjectKey)
  ]);

  return {
    userId: params.userId,
    subscriptionTier: "free",
    rewardedUnlocksUsedToday: counter.unlocksUsed,
    rewardedUnlocksDate: counter.usageDate,
    rewardedUnlocksRemaining: Math.max(
      0,
      ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit - counter.unlocksUsed
    ),
    dailyRewardedUnlockLimit: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
    unlockedMatches: unlocks,
    rewardedAdsEnabled: ENTITLEMENT_FLAGS.rewardedAdsEnabled
  };
}

/**
 * Sblocco partita dopo Rewarded Ad.
 * Guest: passare deviceId. Loggato: userId.
 * In produzione passare adTransactionId verificato via SSV; in dev rewardConfirmed basta se ADS_DEV_TRUST=1.
 */
export async function unlockMatchWithRewardedAd(params: {
  userId?: string | null;
  deviceId?: string | null;
  matchId: number;
  rewardConfirmed: boolean;
  adTransactionId?: string | null;
  role?: UserAccessRole | "guest" | null;
  sourceScreen?: string;
}): Promise<UnlockMatchResult> {
  const subjectKey = resolveSubjectKey({
    userId: params.userId,
    deviceId: params.deviceId
  });

  const entitlements = await buildUserEntitlements({
    userId: params.userId ?? null,
    deviceId: params.deviceId,
    role: params.role
  });

  if (!subjectKey) {
    return {
      ok: false,
      error: "auth_required",
      message: "Identificativo dispositivo o account mancante.",
      entitlements
    };
  }

  if (isProUser(entitlements.subscriptionTier)) {
    return {
      ok: false,
      error: "pro_user",
      message: "Gli utenti Pro hanno già accesso illimitato.",
      entitlements
    };
  }

  if (!Number.isFinite(params.matchId) || params.matchId <= 0) {
    return { ok: false, error: "invalid_match", message: "match_id non valido.", entitlements };
  }

  if (!ENTITLEMENT_FLAGS.rewardedAdsEnabled) {
    return {
      ok: false,
      error: "ads_disabled",
      message: "Le Rewarded Ad non sono disponibili al momento.",
      entitlements
    };
  }

  const requireSsv = process.env.PITCHBRAIN_ADMOB_REQUIRE_SSV === "1";
  const trustDev =
    process.env.PITCHBRAIN_ADS_DEV_TRUST === "1" || process.env.NODE_ENV !== "production";

  if (requireSsv || (params.adTransactionId && !trustDev)) {
    if (!params.adTransactionId?.trim()) {
      return {
        ok: false,
        error: "reward_not_confirmed",
        message: "Manca la ricevuta pubblicitaria verificata.",
        entitlements
      };
    }
    const consumed = await consumeRewardedAdReceipt({
      transactionId: params.adTransactionId.trim(),
      subjectKey,
      matchId: params.matchId
    });
    if (!consumed.ok) {
      return {
        ok: false,
        error: "reward_not_confirmed",
        message: consumed.message ?? "Ricevuta pubblicitaria non valida.",
        entitlements
      };
    }
  } else if (!params.rewardConfirmed) {
    void trackEntitlementEvent("rewarded_ad_failed", {
      userId: params.userId,
      matchId: String(params.matchId),
      sourceScreen: params.sourceScreen,
      subscriptionTier: "free",
      remainingUnlocks: entitlements.rewardedUnlocksRemaining
    });
    return {
      ok: false,
      error: "reward_not_confirmed",
      message: "La ricompensa pubblicitaria non è stata confermata.",
      entitlements
    };
  }

  if (isMatchUnlocked(entitlements.unlockedMatches, params.matchId)) {
    return {
      ok: false,
      error: "already_unlocked",
      message: "Questa partita è già sbloccata.",
      entitlements
    };
  }

  if (entitlements.rewardedUnlocksRemaining <= 0) {
    void trackEntitlementEvent("rewarded_daily_limit_reached", {
      userId: params.userId,
      matchId: String(params.matchId),
      sourceScreen: params.sourceScreen,
      subscriptionTier: "free",
      remainingUnlocks: 0
    });
    return {
      ok: false,
      error: "daily_limit_reached",
      message: `Hai raggiunto il limite di ${ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit} sblocchi gratuiti per oggi.`,
      entitlements
    };
  }

  const counter = await incrementSubjectRewardedCounter(subjectKey);
  if (!counter.ok) {
    const refreshed = await buildUserEntitlements({
      userId: params.userId ?? null,
      deviceId: params.deviceId,
      role: params.role
    });
    return {
      ok: false,
      error: counter.message === "daily_limit_reached" ? "daily_limit_reached" : "persist_failed",
      message:
        counter.message === "daily_limit_reached"
          ? `Hai raggiunto il limite di ${ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit} sblocchi gratuiti per oggi.`
          : counter.message ?? "Impossibile aggiornare il contatore.",
      entitlements: refreshed
    };
  }

  const persist = await upsertSubjectMatchUnlock({
    subjectKey,
    matchId: params.matchId,
    source: "rewarded_ad"
  });

  if (!persist.ok || !persist.unlock) {
    return {
      ok: false,
      error: "persist_failed",
      message: persist.message ?? "Impossibile salvare lo sblocco.",
      entitlements
    };
  }

  const next = await buildUserEntitlements({
    userId: params.userId ?? null,
    deviceId: params.deviceId,
    role: params.role
  });
  void trackEntitlementEvent("rewarded_match_unlocked", {
    userId: params.userId,
    matchId: String(params.matchId),
    sourceScreen: params.sourceScreen,
    subscriptionTier: "free",
    remainingUnlocks: next.rewardedUnlocksRemaining,
    featureKey: "match_full_analysis"
  });

  return { ok: true, unlock: persist.unlock, entitlements: next };
}
