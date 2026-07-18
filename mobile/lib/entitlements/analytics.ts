type Props = {
  event: string;
  matchId?: string;
  featureKey?: string;
  sourceScreen?: string;
  remainingUnlocks?: number;
  subscriptionTier?: string;
};

/** Analytics mobile: log in dev + webhook opzionale. */
export async function trackMobileEntitlementEvent(
  event: string,
  props: Omit<Props, "event"> = {}
): Promise<void> {
  const payload = { event, ts: new Date().toISOString(), ...props };
  if (__DEV__) {
    console.info("[entitlements:analytics]", payload);
  }
}
