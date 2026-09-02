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
 * Piani Pro / IAP sull'app mobile. `false` (default): guest e Free ricevono i contenuti
 * completi, senza paywall. Non si applica al kiosk web.
 */
export const PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED = envBool(
  "PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED",
  false
);

/** Compat: sblocca i contenuti mobile se i piani Pro sono spenti, oppure via env legacy. */
export const PITCHBRAIN_BETA_FREE_FOR_ALL = envBool("PITCHBRAIN_BETA_FREE_FOR_ALL", false);

/** Header inviato da tutte le richieste dell'app mobile (mobile/lib/api.ts) per distinguerle
 * dalle richieste del kiosk web quando condividono lo stesso endpoint backend. */
export const MOBILE_CLIENT_HEADER = "x-pitchbrain-client";
export const MOBILE_CLIENT_HEADER_VALUE = "mobile";

export function isMobileClientRequest(request?: Request | null): boolean {
  if (!request) return false;
  return request.headers.get(MOBILE_CLIENT_HEADER) === MOBILE_CLIENT_HEADER_VALUE;
}

/**
 * Riconosce l'app anche senza header (build App Store vecchie): path /api/mobile/*
 * oppure JWT Bearer (Expo). Il kiosk web usa cookie, non Bearer.
 */
export function isConsumerMobileRequest(request?: Request | null): boolean {
  if (!request) return false;
  if (isMobileClientRequest(request)) return true;
  try {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/mobile/")) return true;
  } catch {
    // ignore
  }
  const authorization = request.headers.get("authorization");
  if (authorization && /^Bearer\s+\S+/i.test(authorization)) return true;
  const deviceId = request.headers.get("x-device-id")?.trim();
  return Boolean(deviceId);
}

/**
 * GET dell'app mobile non devono calcolare/generare dal provider (FootAPI/SportAPI)
 * senza limite: App Review vede spinner infiniti. Il ricalcolo admin resta sul refresh.
 * Le GET possono comunque leggere gli snapshot e, se mancano, tentare un compute a tempo.
 */
export function allowOnDemandProviderCompute(request?: Request | null): boolean {
  return !isConsumerMobileRequest(request);
}

/**
 * Calcolo on-demand di uno snapshot (Player Performance, insight, …).
 * Sul kiosk web è il percorso normale; sull'app è consentito se lo snapshot manca,
 * altrimenti il tab resta vuoto (l'app non può rifare il refresh admin).
 */
export function allowSnapshotComputeIfMissing(request?: Request | null): boolean {
  return allowOnDemandProviderCompute(request) || isConsumerMobileRequest(request);
}

/**
 * true sulle richieste dell'app (anche build vecchie senza header) quando i piani Pro
 * sono disattivati. Mai sul kiosk web (cookie, path /api/tactical senza Bearer).
 */
export function isBetaFreeForAllRequest(request: Request | null | undefined): boolean {
  if (!isConsumerMobileRequest(request)) return false;
  if (!PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED) return true;
  return PITCHBRAIN_BETA_FREE_FOR_ALL;
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
