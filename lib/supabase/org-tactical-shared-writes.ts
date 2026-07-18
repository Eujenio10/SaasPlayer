import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

/** Scrittura affidabile degli snapshot kiosk condivisi (bypass RLS dopo verifica ruolo sulla route). */
export async function upsertMatchesMenuSnapshotForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
}): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("organization_matches_menu_snapshot").upsert(
    {
      organization_id: params.organizationId,
      matches: params.matches as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function upsertInternationalMatchesMenuSnapshotForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
}): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("organization_international_matches_snapshot").upsert(
    {
      organization_id: params.organizationId,
      matches: params.matches as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function upsertKioskMatchInsightsForOrganization(params: {
  organizationId: string;
  eventId: number;
  insightsSnap: number;
  playerDetailLevel: "full" | "team_only";
  metrics: TacticalMetrics[];
  updatedAt: string;
}): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("kiosk_organization_match_insights").upsert(
    {
      organization_id: params.organizationId,
      event_id: params.eventId,
      insights_snap: params.insightsSnap,
      player_detail_level: params.playerDetailLevel,
      metrics: params.metrics as unknown as Record<string, unknown>[],
      updated_at: params.updatedAt
    },
    { onConflict: "organization_id,event_id" }
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

const KIOSK_AUXILIARY_TABLES = [
  "organization_team_performance_snapshot",
  "organization_team_search_cache",
  "organization_yellow_card_snapshot"
] as const;

/** Pulisce cache derivate (non gli insight match): team blueprint, ricerca squadre, cartellini. */
export async function purgeOrganizationKioskAuxiliarySnapshots(
  organizationId: string
): Promise<{ ok: boolean; messages: string[] }> {
  const sb = createSupabaseServiceClient();
  const messages: string[] = [];

  for (const table of KIOSK_AUXILIARY_TABLES) {
    const { error } = await sb.from(table).delete().eq("organization_id", organizationId);
    if (error) messages.push(`${table}: ${error.message}`);
  }

  return { ok: true, messages };
}

/**
 * Prima di una nuova ondata «Aggiorna dati admin» (singola partita kiosk): rimuove tutti gli insight match
 * e tenta la pulizia delle cache correlate. Fallisce solo se gli insight kiosk non sono stati rimossi.
 */
export async function purgeOrganizationKioskDerivedSnapshots(
  organizationId: string
): Promise<{ ok: boolean; messages: string[] }> {
  const sb = createSupabaseServiceClient();
  const messages: string[] = [];

  const { error: e1 } = await sb
    .from("kiosk_organization_match_insights")
    .delete()
    .eq("organization_id", organizationId);
  if (e1) {
    return { ok: false, messages: [`kiosk_organization_match_insights: ${e1.message}`] };
  }

  const auxiliary = await purgeOrganizationKioskAuxiliarySnapshots(organizationId);
  return { ok: true, messages: [...messages, ...auxiliary.messages] };
}

/** Rimuove insight salvati per eventi non più presenti nel menu corrente. */
export async function pruneOrganizationMatchInsightsOutsideEventIds(
  organizationId: string,
  keepEventIds: number[]
): Promise<{ ok: boolean; message?: string }> {
  const keep = new Set(keepEventIds.filter((id) => id > 0));
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("kiosk_organization_match_insights")
    .select("event_id")
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };

  const stale = (data ?? [])
    .map((row) => (typeof row.event_id === "number" ? row.event_id : 0))
    .filter((eventId) => eventId > 0 && !keep.has(eventId));

  if (!stale.length) return { ok: true };

  const chunkSize = 80;
  for (let i = 0; i < stale.length; i += chunkSize) {
    const slice = stale.slice(i, i + chunkSize);
    const { error: deleteError } = await sb
      .from("kiosk_organization_match_insights")
      .delete()
      .eq("organization_id", organizationId)
      .in("event_id", slice);
    if (deleteError) return { ok: false, message: deleteError.message };
  }

  return { ok: true };
}
