import type { TacticalMetrics } from "@/lib/types";

/** Stesso prefisso già usato in precedenza nel kiosk (compatibile con chiavi già salvate). */
export const KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX = "kiosk:match-insights:v1:";
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
