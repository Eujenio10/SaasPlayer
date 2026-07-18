import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { upsertUserProSubscription } from "@/lib/entitlements/repository";

async function upsertOrgSubscriptionFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
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

async function upsertUserProFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId || session.metadata?.product !== "pitchbrain_pro_monthly") return;

  const periodEnd =
    typeof session.expires_at === "number"
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

  await upsertUserProSubscription({
    userId,
    stripeCustomerId: session.customer ? String(session.customer) : null,
    stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
    status: "active",
    currentPeriodEnd: periodEnd
  });
}

async function updateOrgSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
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

async function updateUserProSubscriptionStatus(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId || subscription.metadata?.product !== "pitchbrain_pro_monthly") {
    // fallback: trova per subscription id
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("user_pro_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    if (!data?.user_id) return;

    const periodEndUnix = subscription.items.data[0]?.current_period_end;
    await upsertUserProSubscription({
      userId: data.user_id,
      stripeCustomerId: subscription.customer ? String(subscription.customer) : null,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null
    });
    return;
  }

  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  await upsertUserProSubscription({
    userId,
    stripeCustomerId: subscription.customer ? String(subscription.customer) : null,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null
  });
}

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return new NextResponse("Stripe not configured", { status: 501 });
  }
  const stripe = getStripe();
  const payload = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await upsertOrgSubscriptionFromCheckout(session);
    await upsertUserProFromCheckout(session);
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    await updateOrgSubscriptionStatus(subscription);
    await updateUserProSubscriptionStatus(subscription);
  }

  return NextResponse.json({ received: true });
}
