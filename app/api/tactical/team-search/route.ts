import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { searchTeamsByQuery } from "@/services/sportapi";

const querySchema = z.object({
  q: z.string().min(2).max(60)
});

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
      const cached = await getApiCache<{ teams: Array<{ id: number; name: string }> }>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }

      const teams = await searchTeamsByQuery({
        query: parsed.data.q,
        limit: 20
      });
      const payload = { teams };
      await setApiCache(cacheKey, payload, cacheTtlHours);
      return NextResponse.json(payload);
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

  const subscription = await getSubscriptionContextForOrganization(
    organization.organizationId
  );
  if (organization.role !== "admin" && !subscription?.isOperational) {
    return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
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

  try {
    const cacheKey = `team_search:${parsed.data.q.trim().toLowerCase()}`;
    const cacheTtlHours = Number(process.env.TACTICAL_TEAM_SEARCH_QUERY_CACHE_HOURS ?? "48");
    const cached = await getApiCache<{ teams: Array<{ id: number; name: string }> }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const teams = await searchTeamsByQuery({
      query: parsed.data.q,
      limit: 20
    });

    const payload = { teams };
    await setApiCache(cacheKey, payload, cacheTtlHours);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "team_search_unavailable";
    const status = message.includes("quota_exceeded") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
