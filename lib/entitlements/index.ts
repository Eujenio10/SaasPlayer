export { ENTITLEMENT_FLAGS, MAX_REWARDED_MATCH_UNLOCKS_PER_DAY } from "@/lib/entitlements/config";
export type { EntitlementFeatureKey } from "@/lib/entitlements/config";
export {
  canAccessFeature,
  canUnlockWithRewardedAd,
  emptyGuestEntitlements,
  getRemainingRewardedUnlocks,
  isMatchUnlocked,
  isProUser,
  resolveSubscriptionTier
} from "@/lib/entitlements/access";
export { trackEntitlementEvent } from "@/lib/entitlements/analytics";
export {
  redactDifficultMarkingsList,
  redactSimulationDetail,
  redactTrendsList,
  resolveContentAccessMode
} from "@/lib/entitlements/redact";
export { buildUserEntitlements, unlockMatchWithRewardedAd } from "@/lib/entitlements/service";
export { resolveRequestEntitlements, requestHasMatchUnlock } from "@/lib/entitlements/request";
export type {
  EntitlementDecision,
  MatchUnlock,
  SubscriptionTier,
  UnlockMatchResult,
  UserEntitlements
} from "@/lib/entitlements/types";
