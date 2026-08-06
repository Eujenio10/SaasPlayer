export type UserAccessStatus =
  | "guest"
  | "authenticated_free"
  | "authenticated_pro"
  | "expired_pro";

export type FeatureAccessLevel = "free" | "pro";

export type FeatureId =
  | "home"
  | "matches"
  | "matchList"
  | "basicMatchPreview"
  | "basicStats"
  | "basicTrends"
  | "matchSimulator"
  | "difficultMarkings"
  | "fullPreMatchReport"
  | "advancedMatchAnalysis"
  | "advancedTrends"
  | "exportReport"
  | "savedReports"
  | "customAlerts"
  | "proFilters";

export type PendingAction =
  | {
      type: "open_feature";
      feature: FeatureId;
      matchId?: number;
      returnTab?: "intensity" | "playerPerformance" | "prematch";
    }
  | { type: "restore_purchases" }
  | { type: "sync_data" }
  | { type: "activate_pro" };

export type SubscriptionEntitlementState = "none" | "active" | "expired";

export interface SubscriptionEntitlement {
  state: SubscriptionEntitlementState;
  renewsAt: string | null;
}
