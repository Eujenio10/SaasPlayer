import { computeMatchIntensityPreview } from "@/lib/intensity-analysis";
import { fetchIntensityPreviews, fetchMatchInsights } from "@/lib/api";
import type { MatchIntensityPreview, UpcomingMatchItem } from "@/lib/types";

const previewCache = new Map<number, MatchIntensityPreview>();

function needsPreview(match: UpcomingMatchItem): boolean {
  return match.intensityPreview?.value == null;
}

function rememberPreview(eventId: number, preview: MatchIntensityPreview | null | undefined) {
  if (preview?.value != null) previewCache.set(eventId, preview);
}

function withCachedPreview(match: UpcomingMatchItem): UpcomingMatchItem {
  if (match.intensityPreview?.value != null) {
    previewCache.set(match.eventId, match.intensityPreview);
    return match;
  }
  const cached = previewCache.get(match.eventId);
  return cached ? { ...match, intensityPreview: cached } : match;
}

function previewFromRecord(
  previews: Record<string, MatchIntensityPreview>,
  eventId: number
): MatchIntensityPreview | undefined {
  return previews[String(eventId)] ?? previews[eventId as unknown as string];
}

/** Applica subito i punteggi già visti in sessione, senza nuove richieste. */
export function applyCachedMatchIntensity(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  return matches.map(withCachedPreview);
}

/**
 * Completa i punteggi mancanti con una sola lettura batch, prima di mostrare le card.
 */
export async function completeMatchIntensityBeforePaint(
  matches: UpcomingMatchItem[]
): Promise<UpcomingMatchItem[]> {
  const seeded = applyCachedMatchIntensity(matches);
  for (const match of seeded) rememberPreview(match.eventId, match.intensityPreview);
  const missing = seeded.filter((match) => needsPreview(match));
  if (!missing.length) return seeded;

  const previews = await fetchIntensityPreviews(missing.map((match) => match.eventId));
  for (const match of missing) {
    rememberPreview(match.eventId, previewFromRecord(previews, match.eventId));
  }

  return applyCachedMatchIntensity(seeded);
}

/** Completa i punteggi mancanti dagli insight, prima di mostrare il menu. */
export async function enrichMatchesWithIntensity(
  matches: UpcomingMatchItem[]
): Promise<UpcomingMatchItem[]> {
  const seeded = await completeMatchIntensityBeforePaint(matches);
  const missing = seeded.filter((match) => needsPreview(match));
  if (!missing.length) return seeded;

  const concurrency = 8;
  for (let i = 0; i < missing.length; i += concurrency) {
    const slice = missing.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (match) => {
        try {
          const data = await fetchMatchInsights(match.eventId);
          if (!data.metrics?.length) return;
          const preview = computeMatchIntensityPreview(data.metrics);
          rememberPreview(match.eventId, preview);
        } catch {
          // una partita senza insight non deve svuotare il menu
        }
      })
    );
  }

  return applyCachedMatchIntensity(seeded);
}
