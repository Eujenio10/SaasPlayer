import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";

/**
 * Sull'app, con i piani Pro disattivati, guest e Free hanno accesso completo.
 * Allineare con `isBetaFreeForAllRequest` lato server (`lib/entitlements/config.ts`).
 */
export const PITCHBRAIN_BETA_FREE_FOR_ALL = !PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED;
