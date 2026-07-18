import type { SubscriptionTier } from "@/lib/entitlements/types";

export type EntitlementAnalyticsEvent =
  | "premium_preview_viewed"
  | "rewarded_unlock_clicked"
  | "rewarded_ad_loaded"
  | "rewarded_ad_failed"
  | "rewarded_ad_started"
  | "rewarded_ad_completed"
  | "rewarded_match_unlocked"
  | "rewarded_daily_limit_reached"
  | "pro_paywall_viewed"
  | "pro_upgrade_clicked"
  | "pro_subscription_started"
  | "pro_subscription_completed"
  | "locked_feature_viewed";

export type EntitlementAnalyticsProps = {
  userId?: string | null;
  matchId?: string;
  featureKey?: string;
  leagueId?: string;
  sourceScreen?: string;
  remainingUnlocks?: number;
  subscriptionTier?: SubscriptionTier;
};

/**
 * Adapter analytics: oggi log strutturato; collegare PostHog/Amplitude senza cambiare i call site.
 */
export async function trackEntitlementEvent(
  event: EntitlementAnalyticsEvent,
  props: EntitlementAnalyticsProps = {}
): Promise<void> {
  const payload = {
    event,
    ts: new Date().toISOString(),
    userId: props.userId ?? undefined,
    matchId: props.matchId,
    featureKey: props.featureKey,
    leagueId: props.leagueId,
    sourceScreen: props.sourceScreen,
    remainingUnlocks: props.remainingUnlocks,
    subscriptionTier: props.subscriptionTier
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[entitlements:analytics]", payload);
  }

  // Hook provider futuro (es. PostHog server-side).
  const endpoint = process.env.PITCHBRAIN_ANALYTICS_WEBHOOK_URL?.trim();
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // best-effort
  }
}
