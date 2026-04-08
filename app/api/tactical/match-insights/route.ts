import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";

const querySchema = z.object({
  eventId: z.coerce.number().int().min(1),
  homeTeamId: z.coerce.number().int().min(1).optional(),
  awayTeamId: z.coerce.number().int().min(1).optional(),
  homeTeamName: z.string().min(2).max(120).optional(),
  awayTeamName: z.string().min(2).max(120).optional(),
  competitionSlug: z.string().min(2).max(120).optional(),
  scope: z.enum(["DOMESTIC", "CUP", "EUROPE"]).default("DOMESTIC"),
  forceRefresh: z.enum(["0", "1"]).optional()
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
  const parsed = querySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
    homeTeamId: url.searchParams.get("homeTeamId") ?? undefined,
    awayTeamId: url.searchParams.get("awayTeamId") ?? undefined,
    homeTeamName: url.searchParams.get("homeTeamName") ?? undefined,
    awayTeamName: url.searchParams.get("awayTeamName") ?? undefined,
    competitionSlug: url.searchParams.get("competitionSlug") ?? undefined,
    scope: url.searchParams.get("scope"),
    forceRefresh: url.searchParams.get("forceRefresh") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_params",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const {
    eventId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    competitionSlug,
    scope,
    forceRefresh
  } = parsed.data;
  const includeDiagnostics = url.searchParams.get("diagnostics") === "1";
  const singleMatchTest = url.searchParams.get("singleMatchTest") === "1";
  const forceBlueprintRefresh = forceRefresh === "1";
  const playerAnalyticsMode: "full" | "serie_a_players" =
    url.searchParams.get("playerAnalytics") === "serie_a_players" ? "serie_a_players" : "full";

  const cacheTtlHours = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");

  try {
    const payload = await getOrComputeMatchInsightsPayload(
      {
        eventId,
        homeTeamId,
        awayTeamId,
        homeTeamName,
        awayTeamName,
        competitionSlug: competitionSlug
          ? normalizeCompetitionSlugForInsights(competitionSlug)
          : undefined,
        scope,
        includeDiagnostics,
        singleMatchTest,
        forceBlueprintRefresh,
        playerAnalyticsMode
      },
      cacheTtlHours
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "match_insights_unavailable";
    const status = message.includes("quota_exceeded") || message.includes("429") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
