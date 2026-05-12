import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

/** Stesso prefisso già usato in precedenza nel kiosk (compatibile con chiavi già salvate). */
export const KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX = "kiosk:match-insights:v1:";

/** Elenco match del kiosk salvato dopo fetch calendario (per fixtureId delle route kiosk). */
export const KIOSK_MATCHES_CACHE_PREFIX = "kiosk:matches:v1:";

const KIOSK_MATCHES_CACHE_LOOKUP_FIXTURE_IDS = ["kiosk", "kiosk-hybrid", "kiosk-testing"] as const;

export const KIOSK_ADMIN_INSIGHTS_SNAP_KEY = "kiosk:admin-insights-snap:v1";

/** Broadcast cross-tab / cross-route dopo un aggiornamento admin dal kiosk. */
export const KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT = "tih-kiosk-admin-insights-refresh";

/** Dopo salvataggio snapshot Allarme ammonizioni (localStorage). */
export const YELLOW_CARD_SNAPSHOT_UPDATED_EVENT = "tih-yellow-card-snapshot-updated";

/** Dopo cache locale match-insights (`writeKioskInsightsLocal`). */
export const KIOSK_INSIGHTS_LOCAL_WRITE_EVENT = "tih-kiosk-insights-local-write";

export type KioskInsightsLocalRecord = {
  metrics: TacticalMetrics[];
  playerDetailLevel: "full" | "team_only";
  savedAt: string;
  /** Incrementato dall’admin: i record con lo stesso valore sono “stessa ondata”. */
  insightsSnap: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readAdminInsightsSnap(): number {
  if (!canUseStorage()) return 0;
  try {
    const raw = window.localStorage.getItem(KIOSK_ADMIN_INSIGHTS_SNAP_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeAdminInsightsSnap(value: number): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KIOSK_ADMIN_INSIGHTS_SNAP_KEY, String(Math.max(0, Math.floor(value))));
  } catch {
    // best-effort
  }
}

export function bumpAdminInsightsSnap(): number {
  const next = readAdminInsightsSnap() + 1;
  writeAdminInsightsSnap(next);
  return next;
}

export function readKioskInsightsLocal(eventId: number): KioskInsightsLocalRecord | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(`${KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX}${eventId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KioskInsightsLocalRecord> & {
      metrics?: TacticalMetrics[];
      playerDetailLevel?: string;
    };
    const metrics = Array.isArray(parsed.metrics) ? parsed.metrics : [];
    const playerDetailLevel = parsed.playerDetailLevel === "team_only" ? "team_only" : "full";
    const insightsSnap =
      typeof parsed.insightsSnap === "number" && Number.isFinite(parsed.insightsSnap)
        ? parsed.insightsSnap
        : 0;
    return {
      metrics,
      playerDetailLevel,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
      insightsSnap
    };
  } catch {
    return null;
  }
}

export function writeKioskInsightsLocal(
  eventId: number,
  payload: {
    metrics: TacticalMetrics[];
    playerDetailLevel: "full" | "team_only";
    insightsSnap: number;
  }
): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      `${KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX}${eventId}`,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        metrics: payload.metrics,
        playerDetailLevel: payload.playerDetailLevel,
        insightsSnap: payload.insightsSnap
      })
    );
    window.dispatchEvent(new CustomEvent(KIOSK_INSIGHTS_LOCAL_WRITE_EVENT));
  } catch {
    // best-effort
  }
}

export function kioskInsightsAlignedWithSnap(
  cached: KioskInsightsLocalRecord | null | undefined,
  snap: number
): boolean {
  if (!cached || !cached.metrics.length) return false;
  return cached.insightsSnap === snap;
}

export function readKioskMatchesCache(fixtureId: string): UpcomingMatchItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(`${KIOSK_MATCHES_CACHE_PREFIX}${fixtureId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { matches?: UpcomingMatchItem[] };
    return Array.isArray(parsed.matches) ? parsed.matches : [];
  } catch {
    return [];
  }
}

export function writeKioskMatchesCache(fixtureId: string, matches: UpcomingMatchItem[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      `${KIOSK_MATCHES_CACHE_PREFIX}${fixtureId}`,
      JSON.stringify({ savedAt: new Date().toISOString(), matches })
    );
  } catch {
    // best-effort
  }
}

/** Risolve metadati partita cercando nell’ultima lista match salvata dalle dashboard kiosk note. */
export function findKioskCachedMatchByEventId(eventId: number): UpcomingMatchItem | null {
  for (const fixtureId of KIOSK_MATCHES_CACHE_LOOKUP_FIXTURE_IDS) {
    const hit = readKioskMatchesCache(fixtureId).find((m) => m.eventId === eventId) ?? null;
    if (hit) return hit;
  }
  return null;
}

/**
 * Tutti gli `eventId` con cache match-insights locale (“scontri in campo”) allineata allo snapshot admin corrente.
 */
export function collectKioskInsightEventIdsAlignedToAdminSnap(adminSnap?: number): number[] {
  const snap = typeof adminSnap === "number" && Number.isFinite(adminSnap) ? adminSnap : readAdminInsightsSnap();
  const ids: number[] = [];
  if (!canUseStorage()) return ids;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX)) continue;
    const suffix = key.slice(KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX.length);
    const ev = Number.parseInt(suffix, 10);
    if (!Number.isFinite(ev)) continue;
    const rec = readKioskInsightsLocal(ev);
    if (!kioskInsightsAlignedWithSnap(rec, snap)) continue;
    if (!rec!.metrics.length) continue;
    ids.push(ev);
  }
  ids.sort((a, b) => a - b);
  return ids;
}
