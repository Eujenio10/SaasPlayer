import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";
import type { FeatureAccessLevel, FeatureId, UserAccessStatus } from "@/lib/access/types";
import { t } from "@/lib/i18n";

export const FEATURE_ACCESS: Record<FeatureId, FeatureAccessLevel> = {
  home: "free",
  matches: "free",
  matchList: "free",
  basicMatchPreview: "free",
  basicStats: "free",
  basicTrends: "free",
  matchSimulator: "free",
  difficultMarkings: "free",
  fullPreMatchReport: "free",
  advancedMatchAnalysis: "free",
  advancedTrends: "free",
  exportReport: "free",
  savedReports: "free",
  customAlerts: "free",
  proFilters: "free"
};

export function canAccessFeature(
  userStatus: UserAccessStatus,
  featureAccessLevel: FeatureAccessLevel
): boolean {
  if (!PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED) return true;
  if (featureAccessLevel === "free") return true;
  return userStatus === "authenticated_pro";
}

export function canAccessFeatureId(userStatus: UserAccessStatus, feature: FeatureId): boolean {
  return canAccessFeature(userStatus, FEATURE_ACCESS[feature]);
}

export function userStatusLabel(status: UserAccessStatus): string {
  switch (status) {
    case "guest":
      return t("profile.guestStatus");
    case "authenticated_free":
      return "Free";
    case "authenticated_pro":
      return "Pro";
    case "expired_pro":
      return t("profile.expiredPro");
  }
}
