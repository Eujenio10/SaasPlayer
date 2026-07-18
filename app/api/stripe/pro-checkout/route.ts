import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

/**
 * Checkout Stripe abbonamento Pro mensile per utente autenticato (B2C).
 * Richiede STRIPE_SECRET_KEY + STRIPE_PRICE_ID_PRO_MONTHLY.
 */
export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 501 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim();
  if (!priceId) {
    return NextResponse.json({ error: "pro_price_not_configured" }, { status: 501 });
  }

  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const successUrl =
    parsed.data.successUrl ?? `${appUrl}/kiosk?pro_checkout=success`;
  const cancelUrl = parsed.data.cancelUrl ?? `${appUrl}/kiosk?pro_checkout=cancel`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: {
      userId: user.id,
      product: "pitchbrain_pro_monthly"
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        product: "pitchbrain_pro_monthly"
      }
    }
  });

  return NextResponse.json({ url: session.url, sessionId: session.id }, { status: 201 });
}
