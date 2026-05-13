import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { searchTeamsByQuery } from "@/services/sportapi";

const querySchema = z.object({
  q: z.string().min(2).max(60)
});

function normalizeQueryKey(q: string): string {
  return q.trim().toLowerCase().slice(0, 60);
}

type TeamLite = { id: number; name: string };

async function upsertOrgTeamSearchSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  organizationId: string,
  queryKey: string,
  teams: TeamLite[]
): Promise<void> {
  await supabase.from("organization_team_search_cache").upsert(
    {
      organization_id: organizationId,
      query_key: queryKey,
      teams: teams as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id,query_key" }
  );
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const allowPublicSearchInDev =
    process.env.NODE_ENV === "development" &&
    (process.env.TACTICAL_ALLOW_PUBLIC_TEAM_SEARCH ?? "false").toLowerCase() === "true";

  if (!user && !allowPublicSearchInDev) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  if (!user && allowPublicSearchInDev) {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q")
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

    try {
      const cacheKey = `team_search:${parsed.data.q.trim().toLowerCase()}`;
      const cacheTtlHours = Number(process.env.TACTICAL_TEAM_SEARCH_QUERY_CACHE_HOURS ?? "48");
      const cached = await getApiCache<{ teams: TeamLite[] }>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, teamSearchSource: "dev_provider_cache" });
      }

      const teams = await searchTeamsByQuery({
        query: parsed.data.q,
        limit: 20
      });
      const payload = { teams };
      await setApiCache(cacheKey, payload, cacheTtlHours);
      return NextResponse.json({ ...payload, teamSearchSource: "dev_provider" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "team_search_unavailable";
      const status = message.includes("quota_exceeded") ? 429 : 503;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q")
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

  const queryKey = normalizeQueryKey(parsed.data.q);

  if (organization.role !== "admin") {
    const { data: row, error } = await supabase
      .from("organization_team_search_cache")
      .select("teams")
      .eq("organization_id", organization.organizationId)
      .eq("query_key", queryKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "read_failed" }, { status: 500 });
    }

    const teams = Array.isArray(row?.teams) ? (row.teams as TeamLite[]) : [];
    const persistedSnapshotMissing = row == null;

    return NextResponse.json({
      teams,
      persistedSnapshotMissing,
      teamSearchSource: "organization_db"
    });
  }

  try {
    const cacheKey = `team_search:${queryKey}`;
    const cacheTtlHours = Number(process.env.TACTICAL_TEAM_SEARCH_QUERY_CACHE_HOURS ?? "48");
    const cached = await getApiCache<{ teams: TeamLite[] }>(cacheKey);

    let teams: TeamLite[];
    if (cached?.teams?.length) {
      teams = cached.teams;
    } else {
      teams = await searchTeamsByQuery({
        query: parsed.data.q,
        limit: 20
      });
      const payload = { teams };
      if (teams.length > 0) {
        await setApiCache(cacheKey, payload, cacheTtlHours);
      }
    }

    if (teams.length > 0) {
      await upsertOrgTeamSearchSnapshot(supabase, organization.organizationId, queryKey, teams);
    }

    return NextResponse.json({
      teams,
      persistedSnapshotMissing: false,
      teamSearchSource: cached?.teams?.length ? "provider_redis_cache" : "provider"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "team_search_unavailable";
    const status = message.includes("quota_exceeded") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
