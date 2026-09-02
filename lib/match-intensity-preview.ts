import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeMatchIntensityPreview,
  intensityLevelFromScore,
  mapIntensityLevelForPreview,
  type IntensityLevel
} from "@/lib/intensity-analysis";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export interface MatchIntensityPreview {
  value: number | null;
  label: string;
  level: IntensityLevel;
  uiLevel: "low" | "medium" | "high";
}

function coerceMetricsArray(raw: unknown): TacticalMetrics[] | null {
  if (Array.isArray(raw) && raw.length > 0) return raw as TacticalMetrics[];
  if (typeof raw === "string") {
    try {
      return coerceMetricsArray(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") {
    const nested = (raw as { metrics?: unknown; players?: unknown }).metrics;
    if (nested !== undefined) return coerceMetricsArray(nested);
    const players = (raw as { players?: unknown }).players;
    if (players !== undefined) return coerceMetricsArray(players);
  }
  return null;
}

export function intensityPreviewFromMetrics(metrics: unknown): MatchIntensityPreview | null {
  const rows = coerceMetricsArray(metrics);
  if (!rows?.length) return null;
  const preview = computeMatchIntensityPreview(rows);
  return preview.value != null ? preview : preview.label ? preview : null;
}

const INTENSITY_LEVELS = new Set(["low", "medium", "high", "very_high"]);

function coercePreviewValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Legge un preview già salvato sul JSON del menu calendario. */
export function parseStoredIntensityPreview(raw: unknown): MatchIntensityPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const value = coercePreviewValue(row.value);
  let level =
    typeof row.level === "string" && INTENSITY_LEVELS.has(row.level)
      ? (row.level as IntensityLevel)
      : null;
  let label = typeof row.label === "string" ? row.label.trim() : "";
  if (value != null && (!level || !label)) {
    const derived = intensityLevelFromScore(value);
    level = level ?? derived.level;
    label = label || derived.label;
  }
  if (!label || !level) return null;
  const uiLevel =
    typeof row.uiLevel === "string" &&
    (row.uiLevel === "low" || row.uiLevel === "medium" || row.uiLevel === "high")
      ? row.uiLevel
      : mapIntensityLevelForPreview(level);
  return {
    value,
    label,
    level,
    uiLevel
  };
}

export function matchNeedsIntensityPreview(match: UpcomingMatchItem): boolean {
  return match.intensityPreview?.value == null;
}

function eventIdKey(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function queryInsightRows(
  supabase: SupabaseClient,
  organizationId: string | null,
  eventIds: number[]
): Promise<{ rows: Array<{ event_id: unknown; metrics: unknown }>; error: string | null }> {
  let query = supabase.from("kiosk_organization_match_insights").select("event_id, metrics");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const result = await query.in("event_id", eventIds);
  return {
    rows: result.data ?? [],
    error: result.error?.message ?? null
  };
}

async function loadInsightRowsForChunk(
  supabase: SupabaseClient,
  organizationId: string,
  chunk: number[]
): Promise<Array<{ event_id: unknown; metrics: unknown }>> {
  if (chunk.length > 4) {
    const mid = Math.ceil(chunk.length / 2);
    const [left, right] = await Promise.all([
      loadInsightRowsForChunk(supabase, organizationId, chunk.slice(0, mid)),
      loadInsightRowsForChunk(supabase, organizationId, chunk.slice(mid))
    ]);
    return [...left, ...right];
  }

  const byEvent = new Map<number, { event_id: unknown; metrics: unknown }>();
  const primary = await queryInsightRows(supabase, organizationId, chunk);
  if (primary.error) {
    console.warn("[matches] intensity_preview_read_failed:", primary.error);
    if (chunk.length > 1) {
      const mid = Math.ceil(chunk.length / 2);
      return [
        ...(await loadInsightRowsForChunk(supabase, organizationId, chunk.slice(0, mid))),
        ...(await loadInsightRowsForChunk(supabase, organizationId, chunk.slice(mid)))
      ];
    }
  }
  for (const row of primary.rows) {
    const eventId = eventIdKey(row.event_id);
    if (eventId == null) continue;
    byEvent.set(eventId, row);
  }

  const missing = chunk.filter((id) => {
    const row = byEvent.get(id);
    return !row || intensityPreviewFromMetrics(row.metrics)?.value == null;
  });

  if (missing.length) {
    const fallback = await queryInsightRows(supabase, null, missing);
    if (fallback.error) {
      console.warn("[matches] intensity_preview_fallback_failed:", fallback.error);
    } else {
      for (const row of fallback.rows) {
        const eventId = eventIdKey(row.event_id);
        if (eventId == null || intensityPreviewFromMetrics(byEvent.get(eventId)?.metrics)?.value != null) {
          continue;
        }
        byEvent.set(eventId, row);
      }
    }
  }

  return [...byEvent.values()];
}

const MENU_SNAPSHOT_TABLES = [
  "organization_matches_menu_snapshot",
  "organization_international_matches_snapshot"
] as const;

/** Scrive l'indice intensità sul JSON calendario, così il menu lo rivede senza ricalcolare gli insight. */
export async function stampIntensityPreviewsOnMenuSnapshots(
  organizationId: string,
  previews: Map<number, MatchIntensityPreview>
): Promise<void> {
  if (!organizationId || !previews.size) return;
  const supabase = createSupabaseServiceClient();

  for (const table of MENU_SNAPSHOT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("matches")
      .eq("organization_id", organizationId)
      .limit(1);
    if (error) {
      console.warn(`[matches] intensity_stamp_read_failed:${table}`, error.message);
      continue;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !Array.isArray(row.matches)) continue;

    let changed = 0;
    const matches = row.matches.map((item: unknown) => {
      if (!item || typeof item !== "object") return item;
      const match = item as Record<string, unknown>;
      const eventId = eventIdKey(match.eventId);
      if (eventId == null) return item;
      const preview = previews.get(eventId);
      if (!preview || preview.value == null) return item;
      const current = parseStoredIntensityPreview(match.intensityPreview);
      if (current?.value === preview.value && current.label === preview.label) return item;
      changed += 1;
      return { ...match, intensityPreview: preview };
    });

    if (!changed) continue;
    const persist = await supabase.from(table).upsert(
      {
        organization_id: organizationId,
        matches,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id" }
    );
    if (persist.error) {
      console.warn(`[matches] intensity_stamp_write_failed:${table}`, persist.error.message);
    }
  }
}

export async function getIntensityPreviewsForEventIds(
  organizationId: string,
  eventIds: number[]
): Promise<Map<number, MatchIntensityPreview | null>> {
  const previewByEvent = new Map<number, MatchIntensityPreview | null>();
  const unique = [
    ...new Set(eventIds.map((id) => eventIdKey(id)).filter((id): id is number => id != null))
  ];
  if (!unique.length) return previewByEvent;

  const supabase = createSupabaseServiceClient();
  const chunkSize = 4;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const rows = await loadInsightRowsForChunk(supabase, organizationId, chunk);
    for (const row of rows) {
      const eventId = eventIdKey(row.event_id);
      if (eventId == null || previewByEvent.has(eventId)) continue;
      previewByEvent.set(eventId, intensityPreviewFromMetrics(row.metrics));
    }
  }
  return previewByEvent;
}

export async function attachIntensityPreviewsToMatches(
  _supabase: SupabaseClient,
  organizationId: string,
  matches: UpcomingMatchItem[]
): Promise<Array<UpcomingMatchItem & { intensityPreview: MatchIntensityPreview | null }>> {
  try {
    const eventIds = [
      ...new Set(
        matches
          .filter((m) => matchNeedsIntensityPreview(m))
          .map((m) => eventIdKey(m.eventId))
          .filter((id): id is number => id != null)
      )
    ];
    if (!eventIds.length) {
      return matches.map((m) => ({
        ...m,
        intensityPreview: parseStoredIntensityPreview(m.intensityPreview) ?? null
      }));
    }

    const previewByEvent = await getIntensityPreviewsForEventIds(organizationId, eventIds);

    const attached = matches.map((m) => {
      const fromInsights =
        previewByEvent.get(m.eventId) ?? previewByEvent.get(Number(m.eventId)) ?? null;
      const stored = parseStoredIntensityPreview(m.intensityPreview);
      const intensityPreview =
        fromInsights?.value != null ? fromInsights : stored?.value != null ? stored : fromInsights ?? stored;
      return { ...m, intensityPreview: intensityPreview ?? null };
    });

    const scored = new Map<number, MatchIntensityPreview>();
    for (const match of attached) {
      if (match.intensityPreview?.value != null) {
        scored.set(match.eventId, match.intensityPreview);
      }
    }
    if (scored.size) {
      await stampIntensityPreviewsOnMenuSnapshots(organizationId, scored).catch((error) => {
        console.warn(
          "[matches] intensity_stamp_failed:",
          error instanceof Error ? error.message : String(error)
        );
      });
    }

    console.info("[matches] intensity_previews_attached", {
      organizationId,
      matches: matches.length,
      withPreview: attached.filter((m) => m.intensityPreview?.value != null).length
    });

    return attached;
  } catch (error) {
    console.warn(
      "[matches] intensity_preview_attach_failed:",
      error instanceof Error ? error.message : String(error)
    );
    return matches.map((m) => ({
      ...m,
      intensityPreview: parseStoredIntensityPreview(m.intensityPreview) ?? null
    }));
  }
}

/** Completa i preview mancanti dal client, usando insight già calcolati. */
export async function enrichMatchListIntensityPreviews(
  matches: UpcomingMatchItem[],
  loadMetrics: (eventId: number) => Promise<unknown>
): Promise<UpcomingMatchItem[]> {
  const missing = matches.filter(matchNeedsIntensityPreview);
  if (!missing.length) return matches;

  const previewByEvent = new Map<number, MatchIntensityPreview>();
  const concurrency = 4;
  for (let i = 0; i < missing.length; i += concurrency) {
    const slice = missing.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (match) => {
        try {
          const preview = intensityPreviewFromMetrics(await loadMetrics(match.eventId));
          if (preview?.value != null) previewByEvent.set(match.eventId, preview);
        } catch {
          // best-effort: una partita senza insight non deve bloccare il menu
        }
      })
    );
  }

  if (!previewByEvent.size) return matches;
  return matches.map((match) => {
    const preview = previewByEvent.get(match.eventId);
    return preview ? { ...match, intensityPreview: preview } : match;
  });
}

export function intensityPreviewsToRecord(
  previewByEvent: Map<number, MatchIntensityPreview | null>
): Record<string, MatchIntensityPreview> {
  const previews: Record<string, MatchIntensityPreview> = {};
  for (const [eventId, preview] of previewByEvent) {
    if (!preview) continue;
    if (preview.value == null && !preview.label) continue;
    previews[String(eventId)] = preview;
  }
  return previews;
}

export function formatIntensityPreviewScore(preview: MatchIntensityPreview): string {
  if (preview.value == null) return preview.label;
  return `${preview.label} · ${preview.value.toFixed(1)}`;
}
