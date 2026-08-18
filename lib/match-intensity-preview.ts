import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeMatchIntensityPreview,
  type IntensityLevel
} from "@/lib/intensity-analysis";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export interface MatchIntensityPreview {
  value: number | null;
  label: string;
  level: IntensityLevel;
  uiLevel: "low" | "medium" | "high";
}

export function intensityPreviewFromMetrics(metrics: unknown): MatchIntensityPreview | null {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  return computeMatchIntensityPreview(metrics as TacticalMetrics[]);
}

export async function attachIntensityPreviewsToMatches(
  supabase: SupabaseClient,
  organizationId: string,
  matches: UpcomingMatchItem[]
): Promise<Array<UpcomingMatchItem & { intensityPreview: MatchIntensityPreview | null }>> {
  const eventIds = matches.map((m) => m.eventId).filter((id) => id > 0);
  if (!eventIds.length) {
    return matches.map((m) => ({ ...m, intensityPreview: null }));
  }

  const previewByEvent = new Map<number, MatchIntensityPreview | null>();
  const chunkSize = 80;

  for (let i = 0; i < eventIds.length; i += chunkSize) {
    const chunk = eventIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("kiosk_organization_match_insights")
      .select("event_id, metrics")
      .eq("organization_id", organizationId)
      .in("event_id", chunk);

    if (error) {
      console.warn("[matches] intensity_preview_read_failed:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const eventId = typeof row.event_id === "number" ? row.event_id : Number(row.event_id);
      if (!Number.isFinite(eventId) || eventId <= 0) continue;
      previewByEvent.set(Math.trunc(eventId), intensityPreviewFromMetrics(row.metrics));
    }
  }

  return matches.map((m) => ({
    ...m,
    intensityPreview: previewByEvent.get(m.eventId) ?? null
  }));
}
