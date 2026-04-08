import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAdminOrganizationsForUser } from "@/lib/auth/organization";
import { PLAN_DURATIONS, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

const allowedPlans = SUBSCRIPTION_PLANS.map((item) => item.value) as [
  "prova",
  "mensile",
  "bimensile",
  "trimensile",
  "semestrale",
  "annuale"
];

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  allowedIp: z.string().min(3).max(80),
  allowedIpRanges: z.array(z.string().min(3).max(80)).default([]),
  initialPlan: z.enum(allowedPlans),
  additionalAdminEmail: z.string().email().optional()
});

async function findUserIdByEmail(email: string): Promise<string | null> {
  const service = createSupabaseServiceClient();
  const target = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200
    });
    if (error || !data?.users?.length) return null;

    const user = data.users.find((item) => item.email?.toLowerCase() === target);
    if (user) return user.id;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
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

  const payload = createOrganizationSchema.parse(await request.json());
  const additionalAdminUserId = payload.additionalAdminEmail
    ? await findUserIdByEmail(payload.additionalAdminEmail)
    : null;

  const durationDays = PLAN_DURATIONS[payload.initialPlan];
  const service = createSupabaseServiceClient();

  const { data, error } = await service.rpc("create_organization_with_subscription", {
    actor_user_id: user.id,
    organization_name: payload.name,
    organization_allowed_ip: payload.allowedIp,
    organization_allowed_ip_ranges: payload.allowedIpRanges,
    initial_plan: payload.initialPlan,
    initial_duration_days: durationDays,
    additional_admin_user_id: additionalAdminUserId
  });

  if (error || !data) {
    return NextResponse.json({ error: "create_org_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    organizationId: data as string,
    additionalAdminAssigned: Boolean(additionalAdminUserId)
  });
}
