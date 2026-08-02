import type { UserAccessStatus } from "@/lib/access/types";

export type GuestPreviewMode = "full" | "locked" | "partial";

export function isGuestUser(userStatus: UserAccessStatus): boolean {
  return userStatus === "guest";
}

export function isProUserStatus(userStatus: UserAccessStatus): boolean {
  return userStatus === "authenticated_pro";
}

/**
 * Modalità anteprima contenuti avanzati.
 * - Pro → full
 * - Guest con ADS attiva → partial
 * - Guest senza ADS / Free / Pro scaduto → locked (salvo contentUnlocked esplicito)
 */
export function resolveGuestPreviewMode(
  userStatus: UserAccessStatus,
  previewActive: boolean,
  options?: { contentUnlocked?: boolean }
): GuestPreviewMode {
  if (options?.contentUnlocked || isProUserStatus(userStatus)) return "full";
  if (userStatus === "guest") {
    return previewActive ? "partial" : "locked";
  }
  return "locked";
}

export function shouldObscureGuestStats(
  userStatus: UserAccessStatus,
  _previewActive?: boolean
): boolean {
  return userStatus === "guest";
}

/** Guest: Simulatore + Duelli dopo ADS (15 min). Free: no — solo Pro. */
export function canAccessMatchSimulator(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  if (userStatus === "authenticated_pro") return true;
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

/** Marcature difficili: solo Pro. */
export function canAccessDifficultMarkings(userStatus: UserAccessStatus): boolean {
  return userStatus === "authenticated_pro";
}

/** Graduatoria completa marcature: solo Pro. */
export function canAccessDifficultMarkingsFull(userStatus: UserAccessStatus): boolean {
  return userStatus === "authenticated_pro";
}

export function formatGuestApiError(message: string): string {
  switch (message) {
    case "public_access_unavailable":
      return "Calendario pubblico non disponibile al momento. Puoi comunque esplorare l'app: le statistiche avanzate restano oscurate finché non passi a Pro o sblocchi l'anteprima.";
    default:
      return message;
  }
}
