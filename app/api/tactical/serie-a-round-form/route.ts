import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { buildTacticalMetrics } from "@/lib/predictive";
import type { TacticalMetrics } from "@/lib/types";
import { fetchSerieARoundPlayerPerformances } from "@/services/sportapi";

const querySchema = z.object({
  eventId: z.coerce.number().int().min(1)
});

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subscription = await getSubscriptionContextForOrganization(organization.organizationId);
  if (organization.role !== "admin" && !subscription?.isOperational) {
    return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ eventId: url.searchParams.get("eventId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId } = parsed.data;
  const ttlHours = Number(process.env.TACTICAL_SERIE_A_ROUND_FORM_CACHE_HOURS ?? "6");
  const cacheKey = `serie_a_round_form:v1:${eventId}`;

  const cached = await getApiCache<{ metrics: TacticalMetrics[]; playerCount: number }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const performance = await fetchSerieARoundPlayerPerformances(eventId);
    const metrics: TacticalMetrics[] = performance.map((athlete) =>
      buildTacticalMetrics(athlete, [athlete], {})
    );
    const payload = { metrics, playerCount: metrics.length };
    if (metrics.length > 0) {
      await setApiCache(cacheKey, payload, ttlHours);
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "serie_a_round_form_failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
