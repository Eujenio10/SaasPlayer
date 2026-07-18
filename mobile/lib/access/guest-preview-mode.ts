import type { UserAccessStatus } from "@/lib/access/types";

export type GuestPreviewMode = "full" | "locked" | "partial";

export function isGuestUser(userStatus: UserAccessStatus): boolean {
  return userStatus === "guest";
}

export function resolveGuestPreviewMode(
  userStatus: UserAccessStatus,
  previewActive: boolean
): GuestPreviewMode {
  if (userStatus !== "guest") return "full";
  return previewActive ? "partial" : "locked";
}

export function shouldObscureGuestStats(
  userStatus: UserAccessStatus,
  _previewActive?: boolean
): boolean {
  return userStatus === "guest";
}

/** Guest: Simulatore match + Duelli da monitorare dopo visione ADS (15 min). */
export function canGuestAccessGuestFeatures(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  if (userStatus !== "guest") return true;
  return featuresPreviewActive;
}

/** @deprecated Usare canGuestAccessGuestFeatures */
export function canGuestAccessMatchSimulator(
  userStatus: UserAccessStatus,
  featuresPreviewActive: boolean
): boolean {
  return canGuestAccessGuestFeatures(userStatus, featuresPreviewActive);
}

/** Marcature difficili: account Free/Pro (non Guest). Anteprima Free via API; completa solo Pro. */
export function canAccessDifficultMarkings(userStatus: UserAccessStatus): boolean {
  return userStatus !== "guest";
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
