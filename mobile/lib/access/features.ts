import { PITCHBRAIN_BETA_FREE_FOR_ALL } from "@/lib/access/beta-config";
import type { FeatureAccessLevel, FeatureId, UserAccessStatus } from "@/lib/access/types";

export const FEATURE_ACCESS: Record<FeatureId, FeatureAccessLevel> = {
  home: "free",
  matches: "free",
  matchList: "free",
  basicMatchPreview: "free",
  basicStats: "free",
  basicTrends: "free",
  matchSimulator: "pro",
  /** Completa solo Pro — Free e Guest vedono lock / paywall. */
  difficultMarkings: "pro",
  fullPreMatchReport: "pro",
  advancedMatchAnalysis: "pro",
  advancedTrends: "pro",
  exportReport: "pro",
  savedReports: "pro",
  customAlerts: "pro",
  proFilters: "pro"
};

export function canAccessFeature(
  userStatus: UserAccessStatus,
  featureAccessLevel: FeatureAccessLevel
): boolean {
  if (featureAccessLevel === "free") return true;
  /** Beta free-for-all: le feature "pro" sono aperte anche a guest e Free. */
  if (PITCHBRAIN_BETA_FREE_FOR_ALL) return true;
  return userStatus === "authenticated_pro";
}

export function canAccessFeatureId(userStatus: UserAccessStatus, feature: FeatureId): boolean {
  return canAccessFeature(userStatus, FEATURE_ACCESS[feature]);
}

export function userStatusLabel(status: UserAccessStatus): string {
  switch (status) {
    case "guest":
      return "Modalità Guest";
    case "authenticated_free":
      return "Free";
    case "authenticated_pro":
      return "Pro";
    case "expired_pro":
      return "Pro scaduto";
  }
}
