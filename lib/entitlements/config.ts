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
