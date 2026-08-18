/**
 * Configurazione centralizzata Free / Rewarded Ad / Pro.
 * Modificare qui (o via env) senza spargere magic number nelle schermate.
 */

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw == null || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Limite giornaliero sblocchi partita via Rewarded Ad (Europe/Rome). */
export const MAX_REWARDED_MATCH_UNLOCKS_PER_DAY = envInt(
  "PITCHBRAIN_REWARDED_UNLOCK_DAILY_LIMIT",
  2
);

export const ENTITLEMENT_FLAGS = {
  rewardedAdsEnabled: envBool("PITCHBRAIN_REWARDED_ADS_ENABLED", true),
  dailyRewardedUnlockLimit: MAX_REWARDED_MATCH_UNLOCKS_PER_DAY,
  freeMatchPreviewEnabled: envBool("PITCHBRAIN_FREE_MATCH_PREVIEW_ENABLED", true),
  freeDifficultMarkingsLimit: envInt("PITCHBRAIN_FREE_DIFFICULT_MARKINGS_LIMIT", 2),
  freeTrendPreviewLimit: envInt("PITCHBRAIN_FREE_TREND_PREVIEW_LIMIT", 2),
  freeSimulationPreviewEnabled: envBool("PITCHBRAIN_FREE_SIMULATION_PREVIEW_ENABLED", true)
} as const;

/**
 * Beta pubblica "PitchBrain Beta": tutte le funzionalità sono gratuite per gli utenti
 * autenticati dell'app mobile, senza toccare il modello di accesso admin/pro/member del
 * kiosk web (Tactical Intelligence Hub). Attivo di default, disattivabile via env per il
 * lancio a pagamento senza rimuovere codice. Si applica SOLO alle richieste che arrivano
 * dall'app mobile (vedi header `MOBILE_CLIENT_HEADER`), mai al kiosk web.
 */
export const PITCHBRAIN_BETA_FREE_FOR_ALL = envBool("PITCHBRAIN_BETA_FREE_FOR_ALL", true);

/** Header inviato da tutte le richieste dell'app mobile (mobile/lib/api.ts) per distinguerle
 * dalle richieste del kiosk web quando condividono lo stesso endpoint backend. */
export const MOBILE_CLIENT_HEADER = "x-pitchbrain-client";
export const MOBILE_CLIENT_HEADER_VALUE = "mobile";

export function isMobileClientRequest(request?: Request | null): boolean {
  if (!request) return false;
  return request.headers.get(MOBILE_CLIENT_HEADER) === MOBILE_CLIENT_HEADER_VALUE;
}

/**
 * true per QUALSIASI richiesta dell'app mobile durante la beta free-for-all, autenticata o
 * guest: guest e Free vengono trattati alla pari. Si applica solo se la richiesta arriva
 * dall'app mobile (header client), mai al kiosk web.
 */
export function isBetaFreeForAllRequest(request: Request | null | undefined): boolean {
  return PITCHBRAIN_BETA_FREE_FOR_ALL && isMobileClientRequest(request);
}

export type EntitlementFeatureKey =
  | "match_preview"
  | "match_full_analysis"
  | "difficult_markings_preview"
  | "difficult_markings_full"
  | "simulation_preview"
  | "simulation_full"
  | "trends_preview"
  | "trends_full"
  | "trends_filters"
  | "player_compare"
  | "favorites"
  | "saved_analyses"
  | "custom_alerts"
  | "simulation_customize"
  | "export_share"
  | "all_competitions"
  | "ad_free";

/** Feature Pro-only (non sbloccabili con ad). */
export const PRO_ONLY_FEATURES: ReadonlySet<EntitlementFeatureKey> = new Set([
  "difficult_markings_full",
  "trends_full",
  "trends_filters",
  "player_compare",
  "favorites",
  "saved_analyses",
  "custom_alerts",
  "simulation_customize",
  "export_share",
  "all_competitions",
  "ad_free"
]);

/** Feature sbloccabili a livello partita con Rewarded Ad. */
export const MATCH_UNLOCKABLE_FEATURES: ReadonlySet<EntitlementFeatureKey> = new Set([
  "match_full_analysis",
  "simulation_full"
]);
