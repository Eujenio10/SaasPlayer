import { PITCHBRAIN_BETA_FREE_FOR_ALL } from "@/lib/access/beta-config";
import type { UserAccessStatus } from "@/lib/access/types";

export type GuestPreviewMode = "full" | "locked" | "partial";

export function isGuestUser(userStatus: UserAccessStatus): boolean {
  return userStatus === "guest";
}

export function isProUserStatus(userStatus: UserAccessStatus): boolean {
  return userStatus === "authenticated_pro";
}

/** Durante la Beta, guest e Free hanno lo stesso accesso completo dei Pro. */
export function hasFullBetaAccess(userStatus: UserAccessStatus): boolean {
  return PITCHBRAIN_BETA_FREE_FOR_ALL || isProUserStatus(userStatus);
}

/**
 * Modalità anteprima contenuti avanzati.
 * - Pro (o Beta free-for-all, qualunque userStatus) → full
 * - Guest con ADS attiva (fuori Beta) → partial
 * - Guest senza ADS / Free / Pro scaduto (fuori Beta) → locked (salvo contentUnlocked esplicito)
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

/** Durante la Beta: Simulatore disponibile per tutti, guest incluso, senza pubblicità. */
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

/** Marcature difficili: Pro, o chiunque durante la Beta free-for-all (guest incluso). */
export function canAccessDifficultMarkings(userStatus: UserAccessStatus): boolean {
  return hasFullBetaAccess(userStatus);
}

/** Graduatoria completa marcature: Pro, o chiunque durante la Beta free-for-all. */
export function canAccessDifficultMarkingsFull(userStatus: UserAccessStatus): boolean {
  return hasFullBetaAccess(userStatus);
}

export function formatGuestApiError(message: string): string {
  switch (message) {
    case "public_access_unavailable":
      return "Calendario pubblico non disponibile al momento. Puoi comunque esplorare l'app: le statistiche avanzate restano oscurate finché non passi a Pro o sblocchi l'anteprima.";
    default:
      return message;
  }
}
