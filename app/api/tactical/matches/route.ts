import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import type { UpcomingMatchItem } from "@/services/sportapi";

function filterMatchesByTeamAndCompetition(
  baseList: UpcomingMatchItem[],
  home: string,
  away: string,
  competition: string
): UpcomingMatchItem[] {
  return filterMatchesKickoffInFuture(
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
}

async function upsertOrganizationMatchesSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  organizationId: string,
  matches: UpcomingMatchItem[]
): Promise<void> {
  await supabase.from("organization_matches_menu_snapshot").upsert(
    {
      organization_id: organizationId,
      matches: matches as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
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
  const home = url.searchParams.get("home")?.trim().toLowerCase() ?? "";
  const away = url.searchParams.get("away")?.trim().toLowerCase() ?? "";
  const competition = url.searchParams.get("competition")?.trim().toLowerCase() ?? "";
  const menuCacheHours = Number(process.env.TACTICAL_MATCHES_MENU_CACHE_HOURS ?? "120");
  const menuCacheKey = `tactical_matches_menu:v13:${home || "_"}:${away || "_"}:${competition || "_"}`;

  /** Pro/Member: zero SportAPI/RapidAPI — solo copia salvata dall’organizzazione. */
  if (organization.role !== "admin") {
    try {
      const { data: row, error } = await supabase
        .from("organization_matches_menu_snapshot")
        .select("matches")
        .eq("organization_id", organization.organizationId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: "persisted_matches_read_failed" }, { status: 500 });
      }

      const rawMatches = Array.isArray(row?.matches) ? (row.matches as UpcomingMatchItem[]) : [];
      const futureBase = filterMatchesKickoffInFuture(rawMatches);
      const matchesOut =
        !home && !away && !competition
          ? futureBase
          : filterMatchesByTeamAndCompetition(futureBase, home, away, competition);

      const persistedSnapshotMissing = row == null;

      return NextResponse.json({
        matches: matchesOut,
        total: matchesOut.length,
        persistedSnapshotMissing,
        matchesSource: "organization_db"
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "matches_unavailable";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  try {
    if (!home && !away && !competition) {
      const upcoming = await getOrRefreshTacticalMatchesMenuFull();
      await upsertOrganizationMatchesSnapshot(supabase, organization.organizationId, upcoming);
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length,
        matchesSource: "provider_or_cache"
      });
    }

    const cached = await getApiCache<{ matches: UpcomingMatchItem[]; total: number }>(menuCacheKey);
    if (cached) {
      const upcoming = filterMatchesKickoffInFuture(cached.matches);
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length,
        matchesSource: "provider_or_cache"
      });
    }

    const baseList = await getOrRefreshTacticalMatchesMenuFull();
    await upsertOrganizationMatchesSnapshot(supabase, organization.organizationId, baseList);

    const filtered = filterMatchesByTeamAndCompetition(baseList, home, away, competition);

    const payload = {
      matches: filtered,
      total: filtered.length
    };
    if (payload.total > 0) {
      await setApiCache(menuCacheKey, payload, menuCacheHours);
    }
    return NextResponse.json({
      ...payload,
      matchesSource: "provider_or_cache"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "matches_unavailable";
    const status = message.includes("quota_exceeded") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
