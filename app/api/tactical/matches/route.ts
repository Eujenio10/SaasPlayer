import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import type { UpcomingMatchItem } from "@/services/sportapi";

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

  try {
    const url = new URL(request.url);
    const home = url.searchParams.get("home")?.trim().toLowerCase() ?? "";
    const away = url.searchParams.get("away")?.trim().toLowerCase() ?? "";
    const competition = url.searchParams.get("competition")?.trim().toLowerCase() ?? "";
    const menuCacheHours = Number(process.env.TACTICAL_MATCHES_MENU_CACHE_HOURS ?? "120");
    const menuCacheKey = `tactical_matches_menu:v12:${home || "_"}:${away || "_"}:${competition || "_"}`;

    /** Menu completo: stessa sorgente/cache usata dal programma `/display`. */
    if (!home && !away && !competition) {
      const upcoming = await getOrRefreshTacticalMatchesMenuFull();
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length
      });
    }

    const cached = await getApiCache<{ matches: UpcomingMatchItem[]; total: number }>(menuCacheKey);
    if (cached) {
      const upcoming = filterMatchesKickoffInFuture(cached.matches);
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length
      });
    }

    const baseList = await getOrRefreshTacticalMatchesMenuFull();

    const filtered = filterMatchesKickoffInFuture(
      baseList.filter((match) => {
        const homeName = match.homeTeam.name.toLowerCase();
        const awayName = match.awayTeam.name.toLowerCase();
        const pairMatch =
          (!home || homeName.includes(home) || awayName.includes(home)) &&
          (!away || homeName.includes(away) || awayName.includes(away));
        const competitionMatch = !competition || match.competitionSlug.includes(competition);
        return pairMatch && competitionMatch;
      })
    );

    const payload = {
      matches: filtered,
      total: filtered.length
    };
    await setApiCache(menuCacheKey, payload, menuCacheHours);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "matches_unavailable";
    const status = message.includes("quota_exceeded") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
