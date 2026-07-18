import type { UserAccessRole } from "@/lib/auth/organization";
import {
  ENTITLEMENT_FLAGS,
  MATCH_UNLOCKABLE_FEATURES,
  PRO_ONLY_FEATURES,
  type EntitlementFeatureKey
} from "@/lib/entitlements/config";
import type {
  EntitlementDecision,
  MatchUnlock,
  SubscriptionTier,
  UserEntitlements
} from "@/lib/entitlements/types";

export function resolveSubscriptionTier(params: {
  role?: UserAccessRole | "guest" | null;
  isPro?: boolean;
  isAdmin?: boolean;
}): SubscriptionTier {
  if (params.isAdmin || params.isPro) return "pro";
  if (params.role === "admin" || params.role === "pro") return "pro";
  return "free";
}

export function isProUser(tier: SubscriptionTier): boolean {
  return tier === "pro";
}

export function isMatchUnlocked(
  unlockedMatches: MatchUnlock[],
  matchId: string | number,
  now = new Date()
): boolean {
  const id = String(matchId);
  const nowMs = now.getTime();
  return unlockedMatches.some((row) => {
    if (row.matchId !== id) return false;
    if (row.expiresAt) {
      const exp = Date.parse(row.expiresAt);
      if (Number.isFinite(exp) && exp <= nowMs) return false;
    }
    return true;
  });
}

export function getRemainingRewardedUnlocks(entitlements: UserEntitlements): number {
  if (isProUser(entitlements.subscriptionTier)) return Number.POSITIVE_INFINITY;
  return Math.max(0, entitlements.rewardedUnlocksRemaining);
}

export function canUnlockWithRewardedAd(
  featureKey: EntitlementFeatureKey,
  entitlements: UserEntitlements
): boolean {
  if (!ENTITLEMENT_FLAGS.rewardedAdsEnabled || !entitlements.rewardedAdsEnabled) return false;
  if (isProUser(entitlements.subscriptionTier)) return false;
  if (!MATCH_UNLOCKABLE_FEATURES.has(featureKey)) return false;
  return getRemainingRewardedUnlocks(entitlements) > 0;
}

export function canAccessFeature(
  featureKey: EntitlementFeatureKey,
  entitlements: UserEntitlements,
  context?: { matchId?: string | number }
): EntitlementDecision {
  if (isProUser(entitlements.subscriptionTier)) {
    return { allowed: true, reason: "pro" };
  }

  if (
    featureKey === "match_preview" ||
    featureKey === "difficult_markings_preview" ||
    featureKey === "simulation_preview" ||
    featureKey === "trends_preview"
  ) {
    return { allowed: true, reason: entitlements.userId ? "free_preview" : "guest_preview" };
  }

  if (PRO_ONLY_FEATURES.has(featureKey)) {
    return {
      allowed: false,
      reason: "pro_required",
      canUnlockWithRewardedAd: false
    };
  }

  if (MATCH_UNLOCKABLE_FEATURES.has(featureKey)) {
    const matchId = context?.matchId;
    if (matchId != null && isMatchUnlocked(entitlements.unlockedMatches, matchId)) {
      return { allowed: true, reason: "match_unlocked" };
    }
    const canAd = canUnlockWithRewardedAd(featureKey, entitlements);
    if (!ENTITLEMENT_FLAGS.rewardedAdsEnabled) {
      return {
        allowed: false,
        reason: "ads_disabled",
        canUnlockWithRewardedAd: false
      };
    }
    if (getRemainingRewardedUnlocks(entitlements) <= 0) {
      return {
        allowed: false,
        reason: "daily_limit_reached",
        canUnlockWithRewardedAd: false
      };
    }
    return {
      allowed: false,
      reason: "rewarded_required",
      canUnlockWithRewardedAd: canAd
    };
  }

  return {
    allowed: false,
    reason: "not_unlockable",
    canUnlockWithRewardedAd: false
  };
}

export function emptyGuestEntitlements(): UserEntitlements {
  return {
    userId: null,
    subscriptionTier: "free",
    rewardedUnlocksUsedToday: 0,
    rewardedUnlocksDate: "",
    rewardedUnlocksRemaining: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
    dailyRewardedUnlockLimit: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
    unlockedMatches: [],
    rewardedAdsEnabled: ENTITLEMENT_FLAGS.rewardedAdsEnabled
  };
}
