import type { Session } from "@supabase/supabase-js";
import type { SubscriptionEntitlement, UserAccessStatus } from "@/lib/access/types";
import type { UserAccessSummary } from "@/lib/types";

export function deriveUserAccessStatus(
  session: Session | null,
  access: UserAccessSummary | null,
  subscription: SubscriptionEntitlement
): UserAccessStatus {
  if (!session) return "guest";
  if (subscription.state === "active" || access?.isPro || access?.isAdmin) {
    return "authenticated_pro";
  }
  if (subscription.state === "expired") return "expired_pro";
  return "authenticated_free";
}
