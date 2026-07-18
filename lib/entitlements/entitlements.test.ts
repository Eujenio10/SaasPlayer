import assert from "node:assert/strict";
import {
  canAccessFeature,
  canUnlockWithRewardedAd,
  emptyGuestEntitlements,
  getRemainingRewardedUnlocks,
  isMatchUnlocked,
  isProUser,
  resolveSubscriptionTier
} from "@/lib/entitlements/access";
import { ENTITLEMENT_FLAGS } from "@/lib/entitlements/config";
import {
  redactDifficultMarkingsList,
  redactTrendsList
} from "@/lib/entitlements/redact";
import { romeCalendarDateKey } from "@/lib/entitlements/rome-day";
import type { UserEntitlements } from "@/lib/entitlements/types";

function freeEntitlements(overrides: Partial<UserEntitlements> = {}): UserEntitlements {
  return {
    ...emptyGuestEntitlements(),
    userId: "user-1",
    subscriptionTier: "free",
    rewardedUnlocksUsedToday: 0,
    rewardedUnlocksRemaining: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
    ...overrides
  };
}

assert.equal(resolveSubscriptionTier({ role: "pro" }), "pro");
assert.equal(resolveSubscriptionTier({ role: "member" }), "free");
assert.equal(resolveSubscriptionTier({ isAdmin: true }), "pro");
assert.equal(isProUser("pro"), true);
assert.equal(isProUser("free"), false);

const guest = emptyGuestEntitlements();
assert.equal(canAccessFeature("match_preview", guest).allowed, true);
assert.equal(canAccessFeature("match_full_analysis", guest, { matchId: 1 }).allowed, false);
assert.equal(
  canAccessFeature("match_full_analysis", guest, { matchId: 1 }).allowed === false &&
    canAccessFeature("match_full_analysis", guest, { matchId: 1 }).reason === "rewarded_required",
  true
);

const guestWithBudget = emptyGuestEntitlements();
assert.equal(canUnlockWithRewardedAd("match_full_analysis", guestWithBudget), true);

const free = freeEntitlements();
assert.equal(canAccessFeature("difficult_markings_full", free).allowed, false);
assert.equal(canUnlockWithRewardedAd("match_full_analysis", free), true);
assert.equal(canUnlockWithRewardedAd("trends_full", free), false);

const limited = freeEntitlements({
  rewardedUnlocksUsedToday: ENTITLEMENT_FLAGS.dailyRewardedUnlockLimit,
  rewardedUnlocksRemaining: 0
});
assert.equal(getRemainingRewardedUnlocks(limited), 0);
assert.equal(canUnlockWithRewardedAd("match_full_analysis", limited), false);
const limitedDecision = canAccessFeature("match_full_analysis", limited, { matchId: 42 });
assert.equal(limitedDecision.allowed, false);
if (!limitedDecision.allowed) {
  assert.equal(limitedDecision.reason, "daily_limit_reached");
}

const unlocked = freeEntitlements({
  unlockedMatches: [
    {
      matchId: "99",
      unlockedAt: new Date().toISOString(),
      source: "rewarded_ad"
    }
  ]
});
assert.equal(isMatchUnlocked(unlocked.unlockedMatches, 99), true);
assert.equal(isMatchUnlocked(unlocked.unlockedMatches, 100), false);
assert.equal(canAccessFeature("match_full_analysis", unlocked, { matchId: 99 }).allowed, true);
assert.equal(canAccessFeature("simulation_full", unlocked, { matchId: 99 }).allowed, true);
assert.equal(canAccessFeature("simulation_full", unlocked, { matchId: 100 }).allowed, false);

const pro: UserEntitlements = {
  ...freeEntitlements(),
  subscriptionTier: "pro"
};
assert.equal(canAccessFeature("trends_full", pro).allowed, true);
assert.equal(canAccessFeature("difficult_markings_full", pro).allowed, true);
assert.equal(canUnlockWithRewardedAd("match_full_analysis", pro), false);

const markings = redactDifficultMarkingsList({
  results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
  tier: "free"
});
assert.equal(markings.results.length, ENTITLEMENT_FLAGS.freeDifficultMarkingsLimit);
assert.equal(markings.lockedCount, 2);
assert.equal(markings.accessMode, "preview");

const trends = redactTrendsList({
  results: [
    { id: 1, trendLevel: "strong_growth" },
    { id: 2, trendLevel: "hidden" },
    { id: 3, trendLevel: "positive_trend" }
  ],
  tier: "free"
});
assert.equal(trends.results.length, 2);
assert.equal(trends.accessMode, "preview");

const trendsPro = redactTrendsList({
  results: [{ id: 1 }, { id: 2 }, { id: 3 }],
  tier: "pro"
});
assert.equal(trendsPro.results.length, 3);
assert.equal(trendsPro.accessMode, "full");

assert.match(romeCalendarDateKey(), /^\d{4}-\d{2}-\d{2}$/);

console.log("entitlements.test.ts: ok");
