/** Tipi entitlement mirrored lato mobile (allineati a lib/entitlements). */

export type SubscriptionTier = "free" | "pro";

export type MatchUnlock = {
  matchId: string;
  unlockedAt: string;
  expiresAt?: string | null;
  source: "rewarded_ad" | "pro";
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

export type UnlockMatchResult =
  | {
      ok: true;
      unlock: MatchUnlock;
      entitlements: UserEntitlements;
    }
  | {
      ok: false;
      error: string;
      message: string;
      entitlements?: UserEntitlements;
    };

export type EntitlementFeatureKey =
  | "match_preview"
  | "match_full_analysis"
  | "difficult_markings_preview"
  | "difficult_markings_full"
  | "simulation_preview"
  | "simulation_full"
  | "trends_preview"
  | "trends_full"
  | "trends_filters"
  | "player_compare"
  | "favorites"
  | "saved_analyses"
  | "custom_alerts"
  | "simulation_customize"
  | "export_share"
  | "all_competitions"
  | "ad_free";
