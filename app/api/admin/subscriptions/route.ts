import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAdminOrganizationsForUser } from "@/lib/auth/organization";
import { PLAN_DURATIONS, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

const commonSchema = z.object({
  targetOrganizationId: z.string().uuid().optional()
});

const allowedPlans = SUBSCRIPTION_PLANS.map((item) => item.value) as [
  "prova",
  "mensile",
  "bimensile",
  "trimensile",
  "semestrale",
  "annuale"
];

const actionSchema = z.discriminatedUnion("action", [
  commonSchema.extend({
    action: z.literal("activate"),
    plan: z.enum(allowedPlans)
  }),
  commonSchema.extend({
    action: z.literal("renew"),
    plan: z.enum(allowedPlans)
  }),
  commonSchema.extend({
    action: z.literal("suspend"),
    reason: z.string().max(200).optional()
  })
]);

interface SubscriptionRow {
  id: string;
  organization_id: string;
  stripe_customer_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

function buildBankSubscriptionId(organizationId: string): string {
  const suffix = Date.now().toString(36);
  return `bank_${organizationId.slice(0, 8)}_${suffix}`;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const adminOrganizations = await getAdminOrganizationsForUser(user.id);
  if (!adminOrganizations.length) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = actionSchema.parse(await request.json());
  const targetOrganizationId =
    payload.targetOrganizationId ?? adminOrganizations[0].organizationId;
  const canManageTarget = adminOrganizations.some(
    (item) => item.organizationId === targetOrganizationId
  );

  if (!canManageTarget) {
    return NextResponse.json({ error: "forbidden_target_org" }, { status: 403 });
  }

  const service = createSupabaseServiceClient();

  const { data: currentSubscription } = await service
    .from("subscriptions")
    .select("*")
    .eq("organization_id", targetOrganizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  if (payload.action === "suspend") {
    if (currentSubscription) {
      await service
        .from("subscriptions")
        .update({
          status: "canceled",
          current_period_end: new Date(Date.now() - 60 * 1000).toISOString()
        })
        .eq("id", currentSubscription.id);
    }

    await service.rpc("log_compliance_event", {
      target_org_id: targetOrganizationId,
      target_event_type: "manual_subscription_suspend",
      target_details: {
        actor_user_id: user.id,
        reason: payload.reason ?? null
      }
    });

    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  let currentEnd = now;
  if (payload.action === "renew" && currentSubscription?.current_period_end) {
    const parsed = new Date(currentSubscription.current_period_end);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      currentEnd = parsed;
    }
  }

  const durationDays = PLAN_DURATIONS[payload.plan];
  const nextPeriodEnd = addDays(currentEnd, durationDays).toISOString();

  const subscriptionId = currentSubscription?.id
    ? currentSubscription.id
    : buildBankSubscriptionId(targetOrganizationId);

  const plan =
    payload.action === "activate" ? payload.plan : payload.plan;

  await service.from("subscriptions").upsert(
    {
      id: subscriptionId,
      organization_id: targetOrganizationId,
      stripe_customer_id: "bank_transfer",
      plan,
      status: "active",
      current_period_end: nextPeriodEnd
    },
    { onConflict: "id" }
  );

  await service.rpc("log_compliance_event", {
    target_org_id: targetOrganizationId,
    target_event_type:
      payload.action === "activate"
        ? "manual_subscription_activate"
        : "manual_subscription_renew",
    target_details: {
      actor_user_id: user.id,
      duration_days: durationDays,
      current_period_end: nextPeriodEnd,
      plan
    }
  });

  return NextResponse.json({ ok: true, currentPeriodEnd: nextPeriodEnd });
}
