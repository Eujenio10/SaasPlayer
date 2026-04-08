import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

async function upsertSubscriptionFromCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;

  const supabase = createSupabaseServiceClient();

  await supabase.from("subscriptions").upsert(
    {
      id: String(session.subscription),
      organization_id: organizationId,
      stripe_customer_id: String(session.customer),
      plan: "b2b-standard",
      status: "active",
      current_period_end: null
    },
    { onConflict: "id" }
  );
}

async function updateSubscriptionStatus(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000) : null
    })
    .eq("id", subscription.id);
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await upsertSubscriptionFromCheckout(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type === "customer.subscription.updated") {
    await updateSubscriptionStatus(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}
