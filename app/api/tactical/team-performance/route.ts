import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import type { CompetitionScope, TeamPerformanceBlueprint } from "@/lib/types";
import { fetchTeamPerformanceBlueprint } from "@/services/sportapi";

const querySchema = z.object({
  teamId: z.coerce.number().int().min(1),
  teamName: z.string().min(2).max(120),
  competitionSlug: z.string().min(2).max(120).optional(),
  force: z.enum(["0", "1"]).optional(),
  scope: z.enum(["DOMESTIC", "CUP", "EUROPE"]).default("DOMESTIC")
});

function competitionSlugKey(raw: string | undefined): string {
  const s = raw?.trim().toLowerCase() ?? "";
  return s.slice(0, 120);
}

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

  const slugKey = competitionSlugKey(competitionSlug);

  /** Pro/Member: zero SportAPI — solo snapshot salvato da un admin. */
  if (organization.role !== "admin") {
    const { data: row, error } = await supabase
      .from("organization_team_performance_snapshot")
      .select("blueprint")
      .eq("organization_id", organization.organizationId)
      .eq("team_id", teamId)
      .eq("scope", scope)
      .eq("competition_slug_key", slugKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "read_failed" }, { status: 500 });
    }

    const persistedSnapshotMissing = row == null;
    const blueprint =
      row?.blueprint && typeof row.blueprint === "object"
        ? (row.blueprint as TeamPerformanceBlueprint)
        : null;

    return NextResponse.json({
      teamId,
      teamName,
      scope,
      blueprint,
      persistedSnapshotMissing,
      teamPerformanceSource: "organization_db"
    });
  }

  try {
    const blueprint = await fetchTeamPerformanceBlueprint({
      teamId,
      teamName,
      competitionSlug,
      forceRefresh: force === "1",
      scope
    });

    await supabase.from("organization_team_performance_snapshot").upsert(
      {
        organization_id: organization.organizationId,
        team_id: teamId,
        scope,
        competition_slug_key: slugKey,
        blueprint: blueprint as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "organization_id,team_id,scope,competition_slug_key"
      }
    );

    return NextResponse.json({
      teamId,
      teamName,
      scope,
      blueprint,
      persistedSnapshotMissing: false,
      teamPerformanceSource: "provider_or_cache"
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
