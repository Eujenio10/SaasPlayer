export type SubscriptionTier = "free" | "pro";

export type MatchUnlockSource = "rewarded_ad" | "pro";

export type MatchUnlock = {
  matchId: string;
  unlockedAt: string;
  expiresAt?: string | null;
  source: MatchUnlockSource;
};

export type UserEntitlements = {
  userId: string | null;
  subscriptionTier: SubscriptionTier;
  rewardedUnlocksUsedToday: number;
  rewardedUnlocksDate: string;
  rewardedUnlocksRemaining: number;
  dailyRewardedUnlockLimit: number;
  unlockedMatches: MatchUnlock[];
  rewardedAdsEnabled: boolean;
};

export type EntitlementDecision =
  | { allowed: true; reason: "pro" | "free_preview" | "match_unlocked" | "guest_preview" }
  | {
      allowed: false;
      reason:
        | "pro_required"
        | "rewarded_required"
        | "daily_limit_reached"
        | "auth_required"
        | "ads_disabled"
        | "not_unlockable";
      canUnlockWithRewardedAd: boolean;
    };

export type UnlockMatchResult =
  | {
      ok: true;
      unlock: MatchUnlock;
      entitlements: UserEntitlements;
    }
  | {
      ok: false;
      error:
        | "auth_required"
        | "already_unlocked"
        | "daily_limit_reached"
        | "ads_disabled"
        | "reward_not_confirmed"
        | "pro_user"
        | "invalid_match"
        | "persist_failed";
      message: string;
      entitlements?: UserEntitlements;
    };
