import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { filterMatchesKickoffInFuture, filterRealTeamMatches, narrowMenuToEachTeamsNextMatch } from "@/lib/tactical-matches-filters";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import { upsertMatchesMenuSnapshotForOrganization } from "@/lib/supabase/org-tactical-shared-writes";
import type { UpcomingMatchItem } from "@/services/sportapi";


function mergeInternationalMenuSlices(
  domestic: UpcomingMatchItem[],
  international: UpcomingMatchItem[]
): UpcomingMatchItem[] {
  const byId = new Map<number, UpcomingMatchItem>();
  for (const m of domestic) {
    byId.set(m.eventId, m);
  }
  for (const m of international) {
    if (!byId.has(m.eventId)) byId.set(m.eventId, m);
  }
  return Array.from(byId.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}

async function loadPersistedInternationalMenu(supabase: SupabaseClient, organizationId: string): Promise<{
  matches: UpcomingMatchItem[];
  rowExists: boolean;
}> {
  const { data, error } = await supabase
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[matches] organization_international_matches_snapshot read failed:", error.message);
    return { matches: [], rowExists: false };
  }

  const rowExists = data != null;
  const raw = Array.isArray(data?.matches) ? (data.matches as UpcomingMatchItem[]) : [];

  /** Rimuovi match con nomi placeholder (es. "2A", "W41") — squadre non ancora determinate. */
  const real = filterRealTeamMatches(filterMatchesKickoffInFuture(raw));
  /** Solo la prossima partita per ogni nazionale: evita di riempire il menu con tutta la griglia del torneo. */
  const narrowed = narrowMenuToEachTeamsNextMatch(real);

  return {
    matches: narrowed,
    rowExists
  };
}

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
      const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
      const mergedRaw = mergeInternationalMenuSlices(rawMatches, intlPersisted.matches);
      const futureBase = filterMatchesKickoffInFuture(mergedRaw);
      const matchesOut =
        !home && !away && !competition
          ? futureBase
          : filterMatchesByTeamAndCompetition(futureBase, home, away, competition);

      const persistedSnapshotMissing = row == null;
      const internationalPersistedMissing = !intlPersisted.rowExists;

      return NextResponse.json({
        matches: matchesOut,
        total: matchesOut.length,
        persistedSnapshotMissing,
        internationalPersistedMissing,
        matchesSource: "organization_db"
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "matches_unavailable";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  try {
    if (!home && !away && !competition) {
      const upcomingDomestic = await getOrRefreshTacticalMatchesMenuFull();
      const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
      const upcoming = mergeInternationalMenuSlices(upcomingDomestic, intlPersisted.matches);
      const persist = await upsertMatchesMenuSnapshotForOrganization({
        organizationId: organization.organizationId,
        matches: upcomingDomestic
      });
      if (!persist.ok) {
        console.error("[matches] upsert organization_matches_menu_snapshot failed:", persist.message);
      }
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length,
        internationalPersistedMissing: !intlPersisted.rowExists,
        matchesSource: "provider_or_cache"
      });
    }

    const cached = await getApiCache<{ matches: UpcomingMatchItem[]; total: number }>(menuCacheKey);
    const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
    if (cached) {
      const upcomingDomestic = filterMatchesKickoffInFuture(cached.matches);
      const upcoming = mergeInternationalMenuSlices(upcomingDomestic, intlPersisted.matches);
      return NextResponse.json({
        matches: upcoming,
        total: upcoming.length,
        internationalPersistedMissing: !intlPersisted.rowExists,
        matchesSource: "provider_or_cache"
      });
    }

    const baseListDomestic = await getOrRefreshTacticalMatchesMenuFull();
    const persist = await upsertMatchesMenuSnapshotForOrganization({
      organizationId: organization.organizationId,
      matches: baseListDomestic
    });
    if (!persist.ok) {
      console.error("[matches] upsert organization_matches_menu_snapshot failed:", persist.message);
    }

    const baseListMerged = mergeInternationalMenuSlices(baseListDomestic, intlPersisted.matches);
    const filtered = filterMatchesByTeamAndCompetition(baseListMerged, home, away, competition);

    const payload = {
      matches: filtered,
      total: filtered.length,
      internationalPersistedMissing: !intlPersisted.rowExists
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
