import { getPublicOrganizationId } from "@/lib/auth/public-org";
import { isMonitoredInternationalCompetitionSlug, resolveMatchCompetitionId } from "@/lib/competitions";
import {
  combinePersistedOrganizationMenuSnapshots,
  dedupeMatchesByEventId,
  filterMatchesKickoffInFuture,
  filterRealTeamMatches,
  sortMatchesChronologically
} from "@/lib/tactical-matches-filters";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { UpcomingMatchItem } from "@/services/sportapi";

/** Stessa normalizzazione di `/api/tactical/matches`, con slug competizione canonico. */
export function normalizePersistedMenuRows(raw: unknown): UpcomingMatchItem[] {
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
    const rawSlug = typeof row.competitionSlug === "string" ? row.competitionSlug : "";
    if (!eventId || !homeId || !awayId || !rawSlug) continue;
    const competitionName =
      typeof row.competitionName === "string" ? row.competitionName : rawSlug;
    const resolvedCompetitionId = resolveMatchCompetitionId({
      competitionSlug: rawSlug,
      competitionName
    });
    out.push({
      eventId,
      startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : 0,
      competitionSlug: resolvedCompetitionId ?? rawSlug,
      competitionName,
      statusType: typeof row.statusType === "string" ? row.statusType : undefined,
      homeTeam: {
        id: homeId,
        name: typeof home?.name === "string" ? home.name : "HOME"
      },
      awayTeam: {
        id: awayId,
        name: typeof away?.name === "string" ? away.name : "AWAY"
      }
    });
  }
  return out;
}

function filterMonitoredMatchItems(rows: UpcomingMatchItem[]): UpcomingMatchItem[] {
  return rows.filter((match) => resolveMatchCompetitionId(match) !== null);
}

/** Partite internazionali future dal JSON persistito (senza finestra 7 giorni). */
export function prepareInternationalPersistedMenuRows(rows: UpcomingMatchItem[]): UpcomingMatchItem[] {
  const monitored = filterMonitoredMatchItems(rows);
  const realTeams = filterRealTeamMatches(monitored);
  const future = filterMatchesKickoffInFuture(realTeams);
  return sortMatchesChronologically(dedupeMatchesByEventId(future));
}

async function readPersistedMenuRows(
  organizationId: string
): Promise<{ domesticRows: UpcomingMatchItem[]; intlRows: UpcomingMatchItem[] }> {
  const sb = createSupabaseServiceClient();
  const { data: domestic } = await sb
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { data: intl } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return {
    domesticRows: normalizePersistedMenuRows(domestic?.matches),
    intlRows: normalizePersistedMenuRows(intl?.matches)
  };
}

/** Ultimo snapshot internazionale salvato (qualsiasi org admin). */
export async function loadLatestInternationalPersistedMenu(): Promise<UpcomingMatchItem[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches, organization_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[match-simulator] latest_intl_snapshot_read_failed", { message: error.message });
    return [];
  }

  const rows = normalizePersistedMenuRows(data?.matches);
  const prepared = prepareInternationalPersistedMenuRows(rows);
  console.info("[match-simulator] latest_intl_snapshot", {
    organizationId: data?.organization_id ?? null,
    updatedAt: data?.updated_at ?? null,
    raw: rows.length,
    prepared: prepared.length
  });
  return prepared;
}

async function resolveInternationalMenuForOrganization(
  organizationId: string,
  primaryIntlRows: UpcomingMatchItem[]
): Promise<{ menu: UpcomingMatchItem[]; sourceOrganizationId: string | null }> {
  const primaryMenu = prepareInternationalPersistedMenuRows(primaryIntlRows);
  if (primaryMenu.length > 0) {
    return { menu: primaryMenu, sourceOrganizationId: organizationId };
  }

  const latest = await loadLatestInternationalPersistedMenu();
  if (latest.length > 0) {
    return { menu: latest, sourceOrganizationId: "latest_snapshot" };
  }

  const publicOrgId = getPublicOrganizationId();
  if (publicOrgId && publicOrgId !== organizationId) {
    const publicRows = await readPersistedMenuRows(publicOrgId);
    const publicMenu = prepareInternationalPersistedMenuRows(publicRows.intlRows);
    if (publicMenu.length > 0) {
      return { menu: publicMenu, sourceOrganizationId: publicOrgId };
    }
  }

  return { menu: [], sourceOrganizationId: null };
}

/**
 * Menu partite per il simulatore: solo DB persistito (no SportAPI live).
 * Per Mondiali/Nations integra sempre l'ultimo snapshot internazionale disponibile.
 */
export async function loadBestOrganizationUpcomingMatches(primaryOrganizationId: string): Promise<{
  organizationId: string;
  matches: UpcomingMatchItem[];
  usedFallbackOrganization: boolean;
  menuOrganizationIds: string[];
  internationalSource: string | null;
}> {
  const orgId = primaryOrganizationId.trim();
  const { domesticRows, intlRows } = await readPersistedMenuRows(orgId);
  const domesticMenu = combinePersistedOrganizationMenuSnapshots(domesticRows, []);

  const intlLoaded = await resolveInternationalMenuForOrganization(orgId, intlRows);
  const internationalMenu = intlLoaded.menu;
  const usedFallbackOrganization =
    intlLoaded.sourceOrganizationId != null && intlLoaded.sourceOrganizationId !== orgId;

  let merged = sortMatchesChronologically(
    dedupeMatchesByEventId([...domesticMenu, ...internationalMenu])
  );

  // Garanzia Mondiali / Nations: se il merge generale non contiene quella competizione, rilegge lo snapshot intl.
  const needsIntlBoost = !merged.some((match) => isMonitoredInternationalCompetitionSlug(match.competitionSlug));
  if (needsIntlBoost && internationalMenu.length === 0) {
    const latestIntl = await loadLatestInternationalPersistedMenu();
    if (latestIntl.length > 0) {
      merged = sortMatchesChronologically(dedupeMatchesByEventId([...merged, ...latestIntl]));
    }
  }

  console.info("[match-simulator] menu_loaded", {
    organizationId: orgId,
    usedFallbackOrganization,
    internationalSource: intlLoaded.sourceOrganizationId,
    domestic: domesticRows.length,
    internationalRaw: intlRows.length,
    domesticMenu: domesticMenu.length,
    internationalMenu: internationalMenu.length,
    merged: merged.length,
    worldCup: merged.filter((m) => resolveMatchCompetitionId(m) === "world-cup").length
  });

  const menuOrganizationIds = [orgId];
  if (intlLoaded.sourceOrganizationId && intlLoaded.sourceOrganizationId !== orgId) {
    menuOrganizationIds.push(intlLoaded.sourceOrganizationId);
  }

  return {
    organizationId: orgId,
    matches: merged,
    usedFallbackOrganization,
    menuOrganizationIds,
    internationalSource: intlLoaded.sourceOrganizationId
  };
}

/** Partite future dell'organizzazione (menu kiosk persistito). */
export async function loadOrganizationUpcomingMatches(organizationId: string): Promise<UpcomingMatchItem[]> {
  const loaded = await loadBestOrganizationUpcomingMatches(organizationId);
  return loaded.matches;
}
