import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { upsertUserProSubscription } from "@/lib/entitlements/repository";
import { trackEntitlementEvent } from "@/lib/entitlements/analytics";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  active: z.boolean(),
  expiresAt: z.string().datetime().nullable().optional(),
  productId: z.string().max(120).nullable().optional(),
  provider: z.enum(["app_store", "play_store", "revenuecat", "mock"]).optional()
});

/**
 * Dopo acquisto/restore IAP (App Store / Play via RevenueCat),
 * sincronizza lo stato Pro sull'utente autenticato.
 *
 * In produzione la fonte di verità resta il webhook RevenueCat;
 * questo endpoint aggiorna subito l'UX dopo il pagamento.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const status = parsed.data.active ? "active" : "expired";
  const result = await upsertUserProSubscription({
    userId: user.id,
    stripeCustomerId: null,
    stripeSubscriptionId: parsed.data.productId
      ? `iap:${parsed.data.provider ?? "revenuecat"}:${parsed.data.productId}`
      : `iap:${user.id}`,
    status,
    currentPeriodEnd: parsed.data.active ? parsed.data.expiresAt ?? null : null
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message ?? "persist_failed" }, { status: 500 });
  }

  void trackEntitlementEvent(
    parsed.data.active ? "pro_subscription_completed" : "pro_paywall_viewed",
    {
      userId: user.id,
      subscriptionTier: parsed.data.active ? "pro" : "free",
      featureKey: parsed.data.provider ?? "iap"
    }
  );

  return NextResponse.json({ ok: true, status });
}
