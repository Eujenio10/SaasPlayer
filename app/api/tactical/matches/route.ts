export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import {
  combinePersistedOrganizationMenuSnapshots,
  filterMatchesKickoffInFuture,
  mergeDomesticAndInternationalUpcomingMenus
} from "@/lib/tactical-matches-filters";
import { localizeUpcomingMatches } from "@/lib/italian-sports-display";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import { attachIntensityPreviewsToMatches } from "@/lib/match-intensity-preview";
import { isConsumerMobileRequest } from "@/lib/entitlements/config";
import { upsertMatchesMenuSnapshotForOrganization } from "@/lib/supabase/org-tactical-shared-writes";
import type { UpcomingMatchItem } from "@/services/sportapi";

async function withListIntensityPreviews(
  request: Request,
  supabase: SupabaseClient,
  organizationId: string,
  matches: UpcomingMatchItem[]
) {
  /** App mobile: solo snapshot calendario. I badge intensità si calcolano in analisi partita. */
  if (isConsumerMobileRequest(request)) {
    return matches.map((match) => ({ ...match, intensityPreview: null }));
  }
  return attachIntensityPreviewsToMatches(supabase, organizationId, matches);
}


function mergeInternationalMenuSlices(
  domestic: UpcomingMatchItem[],
  international: UpcomingMatchItem[]
): UpcomingMatchItem[] {
  return combinePersistedOrganizationMenuSnapshots(domestic, international);
}

function parseOptionalMatchRound(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

function normalizePersistedMenuRows(raw: unknown): UpcomingMatchItem[] {
  if (!Array.isArray(raw)) return [];
  const out: UpcomingMatchItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const eventId = Number(row.eventId);
    const startTimestamp = Number(row.startTimestamp);
    const home = row.homeTeam as { id?: unknown; name?: unknown } | undefined;
    const away = row.awayTeam as { id?: unknown; name?: unknown } | undefined;
    const homeId = Number(home?.id);
    const awayId = Number(away?.id);
    const competitionSlug =
      typeof row.competitionSlug === "string" ? row.competitionSlug : "";
    if (!eventId || !homeId || !awayId || !competitionSlug) continue;
    out.push({
      eventId,
      startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : 0,
      competitionSlug,
      competitionName:
        typeof row.competitionName === "string" ? row.competitionName : competitionSlug,
      statusType: typeof row.statusType === "string" ? row.statusType : undefined,
      homeTeam: {
        id: homeId,
        name: typeof home?.name === "string" ? home.name : "HOME"
      },
      awayTeam: {
        id: awayId,
        name: typeof away?.name === "string" ? away.name : "AWAY"
      },
      round: parseOptionalMatchRound(row.round)
    });
  }
  return out;
}

async function loadSnapshotMenuRows(
  supabase: SupabaseClient,
  table: "organization_matches_menu_snapshot" | "organization_international_matches_snapshot",
  organizationId: string
): Promise<{
  matches: UpcomingMatchItem[];
  rowExists: boolean;
}> {
  /** `.limit(1)` invece di `.maybeSingle()`: 0 righe non deve diventare 406/PGRST116. */
  const { data, error } = await supabase
    .from(table)
    .select("matches")
    .eq("organization_id", organizationId)
    .limit(1);

  if (error) {
    console.error(`[matches] ${table} read failed:`, error.code, error.message, { organizationId });
    return { matches: [], rowExists: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { matches: [], rowExists: false };
  }

  return {
    matches: normalizePersistedMenuRows(row.matches),
    rowExists: true
  };
}

async function loadPersistedInternationalMenu(supabase: SupabaseClient, organizationId: string) {
  return loadSnapshotMenuRows(supabase, "organization_international_matches_snapshot", organizationId);
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
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const supabase = ctx.supabase;
  const organization = {
    organizationId: ctx.organizationId,
    role: ctx.role === "guest" ? ("member" as const) : ctx.role
  };

  const url = new URL(request.url);
  const home = url.searchParams.get("home")?.trim().toLowerCase() ?? "";
  const away = url.searchParams.get("away")?.trim().toLowerCase() ?? "";
  const competition = url.searchParams.get("competition")?.trim().toLowerCase() ?? "";
  const menuCacheHours = Number(process.env.TACTICAL_MATCHES_MENU_CACHE_HOURS ?? "120");
  const menuCacheKey = `tactical_matches_menu:v16:${home || "_"}:${away || "_"}:${competition || "_"}`;

  /** Pro/Member: zero SportAPI/RapidAPI — solo copia salvata dall’organizzazione. */
  if (organization.role !== "admin") {
    try {
      const domestic = await loadSnapshotMenuRows(
        supabase,
        "organization_matches_menu_snapshot",
        organization.organizationId
      );
      const rawMatches = domestic.matches;
      const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
      const rawIntl = intlPersisted.matches;
      const mergedRaw = combinePersistedOrganizationMenuSnapshots(rawMatches, rawIntl);
      const matchesOut =
        !home && !away && !competition
          ? mergedRaw
          : filterMatchesByTeamAndCompetition(mergedRaw, home, away, competition);

      const matchesWithPreview = await withListIntensityPreviews(
        request,
        supabase,
        organization.organizationId,
        matchesOut
      );

      const persistedSnapshotMissing = !domestic.rowExists;
      const internationalPersistedMissing = !intlPersisted.rowExists;

      return NextResponse.json({
        matches: localizeUpcomingMatches(matchesWithPreview),
        total: matchesWithPreview.length,
        persistedSnapshotMissing,
        internationalPersistedMissing,
        domesticPersistedCount: rawMatches.length,
        internationalPersistedCount: rawIntl.length,
        matchesSource: "organization_db"
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "matches_unavailable";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  try {
    if (!home && !away && !competition) {
      /** Admin: stesso menu persistito dal refresh (domestic + internazionale in DB), non rifetch live. */
      const domestic = await loadSnapshotMenuRows(
        supabase,
        "organization_matches_menu_snapshot",
        organization.organizationId
      );
      const rawDomestic = domestic.matches;
      const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
      const upcoming = mergeInternationalMenuSlices(rawDomestic, intlPersisted.matches);
      const upcomingWithPreview = await withListIntensityPreviews(
        request,
        supabase,
        organization.organizationId,
        upcoming
      );
      return NextResponse.json({
        matches: localizeUpcomingMatches(upcomingWithPreview),
        total: upcomingWithPreview.length,
        persistedSnapshotMissing: !domestic.rowExists,
        internationalPersistedMissing: !intlPersisted.rowExists,
        domesticPersistedCount: rawDomestic.length,
        internationalPersistedCount: intlPersisted.matches.length,
        matchesSource: "organization_db"
      });
    }

    const cached = await getApiCache<{ matches: UpcomingMatchItem[]; total: number }>(menuCacheKey);
    const intlPersisted = await loadPersistedInternationalMenu(supabase, organization.organizationId);
    if (cached) {
      const upcoming = mergeDomesticAndInternationalUpcomingMenus(
        cached.matches,
        intlPersisted.matches
      );
      const upcomingWithPreview = await withListIntensityPreviews(
        request,
        supabase,
        organization.organizationId,
        upcoming
      );
      return NextResponse.json({
        matches: localizeUpcomingMatches(upcomingWithPreview),
        total: upcomingWithPreview.length,
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
    const filteredWithPreview = await withListIntensityPreviews(
      request,
      supabase,
      organization.organizationId,
      filtered
    );

    const payload = {
      matches: filteredWithPreview,
      total: filteredWithPreview.length,
      internationalPersistedMissing: !intlPersisted.rowExists
    };
    if (payload.total > 0) {
      await setApiCache(menuCacheKey, payload, menuCacheHours);
    }
    return NextResponse.json({
      ...payload,
      matches: localizeUpcomingMatches(payload.matches),
      matchesSource: "provider_or_cache"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "matches_unavailable";
    const status = message.includes("quota_exceeded") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
