import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import type { CompetitionScope } from "@/lib/types";
import { fetchTeamPerformanceBlueprint } from "@/services/sportapi";

const querySchema = z.object({
  teamId: z.coerce.number().int().min(1),
  teamName: z.string().min(2).max(120),
  competitionSlug: z.string().min(2).max(120).optional(),
  force: z.enum(["0", "1"]).optional(),
  scope: z.enum(["DOMESTIC", "CUP", "EUROPE"]).default("DOMESTIC")
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

  const subscription = await getSubscriptionContextForOrganization(
    organization.organizationId
  );
  if (organization.role !== "admin" && !subscription?.isOperational) {
    return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    teamId: url.searchParams.get("teamId"),
    teamName: url.searchParams.get("teamName"),
    competitionSlug: url.searchParams.get("competitionSlug") ?? undefined,
    force: url.searchParams.get("force") ?? undefined,
    scope: url.searchParams.get("scope")
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

  const { teamId, teamName, competitionSlug, force, scope } = parsed.data as {
    teamId: number;
    teamName: string;
    competitionSlug?: string;
    force?: "0" | "1";
    scope: CompetitionScope;
  };

  try {
    const blueprint = await fetchTeamPerformanceBlueprint({
      teamId,
      teamName,
      competitionSlug,
      forceRefresh: force === "1",
      scope
    });

    return NextResponse.json({
      teamId,
      teamName,
      scope,
      blueprint
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "team_performance_unavailable";
    const status = message.includes("daily_budget_exceeded")
      ? 429
      : message.includes("team_not_in_top5_scope")
        ? 400
        : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
