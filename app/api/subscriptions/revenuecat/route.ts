import { NextResponse } from "next/server";
import { upsertUserProSubscription } from "@/lib/entitlements/repository";
import { trackEntitlementEvent } from "@/lib/entitlements/analytics";

export const dynamic = "force-dynamic";

/**
 * Webhook RevenueCat → aggiorna user_pro_subscriptions.
 * Configura in RevenueCat: Project → Integrations → Webhooks
 * URL: https://<backend>/api/subscriptions/revenuecat
 * Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 *
 * Eventi rilevanti: INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE,
 * CANCELLATION, EXPIRATION, BILLING_ISSUE, UNCANCELLATION
 */
export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization")?.trim();
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: {
    event?: {
      type?: string;
      app_user_id?: string;
      expiration_at_ms?: number | null;
      product_id?: string;
    };
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = payload.event;
  const userId = event?.app_user_id?.trim();
  if (!userId || userId.startsWith("$RCAnonymousID")) {
    // Ignora eventi anonimi non collegati all'account PitchBrain
    return NextResponse.json({ ok: true, ignored: true });
  }

  const type = (event?.type ?? "").toUpperCase();
  const activeTypes = new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE"
  ]);
  const expiredTypes = new Set(["EXPIRATION", "CANCELLATION"]);

  let status = "active";
  if (expiredTypes.has(type)) status = type === "CANCELLATION" ? "canceled" : "expired";
  else if (type === "BILLING_ISSUE") status = "past_due";
  else if (!activeTypes.has(type) && type) {
    // altri eventi: lascia active se c'è expiration futura
    const exp = event?.expiration_at_ms;
    if (typeof exp === "number" && exp > Date.now()) status = "active";
    else if (typeof exp === "number") status = "expired";
  }

  const currentPeriodEnd =
    typeof event?.expiration_at_ms === "number"
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

  const operational =
    status === "active" ||
    (status === "canceled" &&
      currentPeriodEnd != null &&
      Date.parse(currentPeriodEnd) > Date.now());

  await upsertUserProSubscription({
    userId,
    stripeCustomerId: null,
    stripeSubscriptionId: event?.product_id
      ? `iap:revenuecat:${event.product_id}`
      : `iap:revenuecat:${userId}`,
    status: operational ? "active" : status,
    currentPeriodEnd
  });

  if (operational) {
    void trackEntitlementEvent("pro_subscription_completed", {
      userId,
      subscriptionTier: "pro",
      featureKey: "revenuecat"
    });
  }

  return NextResponse.json({ ok: true });
}
