import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";
import type { Session } from "@supabase/supabase-js";
import type { SubscriptionEntitlement, UserAccessStatus } from "@/lib/access/types";
import type { UserAccessSummary } from "@/lib/types";

export function deriveUserAccessStatus(
  session: Session | null,
  access: UserAccessSummary | null,
  subscription: SubscriptionEntitlement
): UserAccessStatus {
  if (!session) return "guest";
  if (!PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED) {
    return "authenticated_free";
  }
  if (subscription.state === "active" || access?.isPro || access?.isAdmin) {
    return "authenticated_pro";
  }
  if (subscription.state === "expired" || access?.subscriptionStatus === "expired") {
    return "expired_pro";
  }
  return "authenticated_free";
}
