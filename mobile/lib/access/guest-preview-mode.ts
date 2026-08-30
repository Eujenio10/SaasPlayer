import { PITCHBRAIN_BETA_FREE_FOR_ALL } from "@/lib/access/beta-config";
import type { UserAccessStatus } from "@/lib/access/types";

export type GuestPreviewMode = "full" | "locked" | "partial";

export function isGuestUser(userStatus: UserAccessStatus): boolean {
  return userStatus === "guest";
}

export function isProUserStatus(userStatus: UserAccessStatus): boolean {
  return userStatus === "authenticated_pro";
}

export function hasFullBetaAccess(userStatus: UserAccessStatus): boolean {
  return PITCHBRAIN_BETA_FREE_FOR_ALL || isProUserStatus(userStatus);
}

/**
 * Modalità anteprima contenuti avanzati.
 * - Pro (o free-for-all di test) → full
 * - Guest con ADS attiva → partial
 * - Guest senza ADS / Free / Pro scaduto → locked (salvo contentUnlocked esplicito)
 */
export function resolveGuestPreviewMode(
  userStatus: UserAccessStatus,
  previewActive: boolean,
  options?: { contentUnlocked?: boolean }
): GuestPreviewMode {
  if (options?.contentUnlocked || hasFullBetaAccess(userStatus)) return "full";
  if (userStatus === "guest") {
    return previewActive ? "partial" : "locked";
  }
  return "locked";
}

export function shouldObscureGuestStats(
  userStatus: UserAccessStatus,
  _previewActive?: boolean
): boolean {
  if (hasFullBetaAccess(userStatus)) return false;
  return userStatus === "guest";
}

export function canAccessMatchSimulator(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  if (hasFullBetaAccess(userStatus)) return true;
  if (userStatus === "guest") return featuresPreviewActive;
  return false;
}

/** @deprecated Usare canAccessMatchSimulator */
export function canGuestAccessGuestFeatures(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  return canAccessMatchSimulator(userStatus, featuresPreviewActive);
}

/** @deprecated Usare canAccessMatchSimulator */
export function canGuestAccessMatchSimulator(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  return canAccessMatchSimulator(userStatus, featuresPreviewActive);
}

export function canAccessDifficultMarkings(userStatus: UserAccessStatus): boolean {
  return hasFullBetaAccess(userStatus);
}

export function canAccessDifficultMarkingsFull(userStatus: UserAccessStatus): boolean {
  return hasFullBetaAccess(userStatus);
}

export function formatGuestApiError(message: string): string {
  switch (message) {
    case "public_access_unavailable":
      return "Calendario pubblico non disponibile al momento. Puoi comunque esplorare l'app.";
    case "persisted_matches_read_failed":
      return "Calendario non disponibile al momento. Riprova tra poco.";
    default:
      return message;
  }
}
