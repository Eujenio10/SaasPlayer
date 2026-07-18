import type { FeatureAccessLevel, FeatureId, UserAccessStatus } from "@/lib/access/types";

export const FEATURE_ACCESS: Record<FeatureId, FeatureAccessLevel> = {
  home: "free",
  matches: "free",
  matchList: "free",
  basicMatchPreview: "free",
  basicStats: "free",
  basicTrends: "free",
  matchSimulator: "free",
  /** Anteprima Free (prime 2); completa solo Pro — enforcement anche in API. */
  difficultMarkings: "free",
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
