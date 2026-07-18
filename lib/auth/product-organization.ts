import { getPublicOrganizationId } from "@/lib/auth/public-org";
import type { DifficultMarkingsSnapshot } from "@/lib/difficult-markings/types";
import {
  snapshotHasPublishedMarkingsData
} from "@/lib/difficult-markings/query";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

let cachedProductOrgId: string | null | undefined;
let cachedProductOrgAt = 0;
let cachedMarkingsOrgId: string | null | undefined;
let cachedMarkingsOrgAt = 0;
const PRODUCT_ORG_CACHE_TTL_MS = 30_000;

function markingsSnapshotHasMatchups(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  return snapshotHasPublishedMarkingsData(snapshot as DifficultMarkingsSnapshot);
}

function menuSnapshotHasMatches(matches: unknown): boolean {
  return Array.isArray(matches) && matches.length > 0;
}

async function findOrganizationIdWithMarkingsSnapshot(): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data: markingsRows, error: markingsError } = await supabase
    .from("organization_difficult_markings_snapshot")
    .select("organization_id,snapshot,updated_at")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (markingsError) return null;

  for (const row of markingsRows ?? []) {
    if (row.organization_id && markingsSnapshotHasMatchups(row.snapshot)) {
      return row.organization_id;
    }
  }

  return null;
}

async function configuredOrganizationHasCatalogData(orgId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();

  const { data: markingsRow } = await supabase
    .from("organization_difficult_markings_snapshot")
    .select("snapshot")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (markingsSnapshotHasMatchups(markingsRow?.snapshot)) return true;

  const { data: menuRow } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (menuSnapshotHasMatches(menuRow?.matches)) return true;

  const { data: intlRow } = await supabase
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", orgId)
    .maybeSingle();

  return menuSnapshotHasMatches(intlRow?.matches);
}

export async function resolveFallbackProductOrganizationId(): Promise<string | null> {
  const supabase = createSupabaseServiceClient();

  const markingsOrgId = await findOrganizationIdWithMarkingsSnapshot();
  if (markingsOrgId) return markingsOrgId;

  const { data: menuRows, error: menuError } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("organization_id,matches,updated_at")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (!menuError) {
    for (const row of menuRows ?? []) {
      if (row.organization_id && menuSnapshotHasMatches(row.matches)) {
        return row.organization_id;
      }
    }
  }

  const { data: intlRows, error: intlError } = await supabase
    .from("organization_international_matches_snapshot")
    .select("organization_id,matches,updated_at")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (!intlError) {
    for (const row of intlRows ?? []) {
      if (row.organization_id && menuSnapshotHasMatches(row.matches)) {
        return row.organization_id;
      }
    }
  }

  const { data: latestMarkings } = await supabase
    .from("organization_difficult_markings_snapshot")
    .select("organization_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestMarkings?.organization_id) return latestMarkings.organization_id;

  const { data: latestMenu, error: latestMenuError } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("organization_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMenuError) {
    console.error("[product-organization] fallback lookup failed:", latestMenuError.message);
    return null;
  }

  return latestMenu?.organization_id ?? null;
}

/**
 * Org canonica del catalogo (calendario, insight, trend, simulatore).
 * Se PITCHBRAIN_PUBLIC_ORG_ID punta a un UUID senza snapshot reali, usa l'org admin con dati.
 */
export async function resolveProductOrganizationId(): Promise<string | null> {
  const now = Date.now();
  if (
    cachedProductOrgId !== undefined &&
    now - cachedProductOrgAt < PRODUCT_ORG_CACHE_TTL_MS
  ) {
    return cachedProductOrgId;
  }

  const configured = getPublicOrganizationId();
  let resolved: string | null = null;

  if (configured && (await configuredOrganizationHasCatalogData(configured))) {
    resolved = configured;
  } else {
    if (configured) {
      console.info("[product-organization] configured_org_without_catalog", {
        organizationId: configured
      });
    }
    resolved = await resolveFallbackProductOrganizationId();
  }

  cachedProductOrgId = resolved;
  cachedProductOrgAt = now;
  return resolved;
}

/**
 * Org per Marcature difficili: preferisce sempre lo snapshot con duelli pubblicati,
 * anche se PITCHBRAIN_PUBLIC_ORG_ID è un placeholder vuoto.
 */
export async function resolveMarkingsCatalogOrganizationId(): Promise<string | null> {
  const now = Date.now();
  if (
    cachedMarkingsOrgId !== undefined &&
    now - cachedMarkingsOrgAt < PRODUCT_ORG_CACHE_TTL_MS
  ) {
    return cachedMarkingsOrgId;
  }

  const configured = getPublicOrganizationId();
  if (configured && (await configuredOrganizationHasMarkingsData(configured))) {
    cachedMarkingsOrgId = configured;
    cachedMarkingsOrgAt = now;
    return configured;
  }

  const resolved =
    (await findOrganizationIdWithMarkingsSnapshot()) ?? (await resolveProductOrganizationId());

  cachedMarkingsOrgId = resolved;
  cachedMarkingsOrgAt = now;
  return resolved;
}

async function configuredOrganizationHasMarkingsData(orgId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { data: markingsRow } = await supabase
    .from("organization_difficult_markings_snapshot")
    .select("snapshot")
    .eq("organization_id", orgId)
    .maybeSingle();

  return markingsSnapshotHasMatchups(markingsRow?.snapshot);
}
