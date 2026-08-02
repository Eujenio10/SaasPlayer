import type { ApiAccessContext } from "@/lib/auth/resolve-api-access";
import type { SubscriptionTier } from "@/lib/entitlements/types";

/**
 * Match Radar completo solo per Pro/admin (ruolo org o subscription IAP).
 * Member free autenticati restano in anteprima limitata, come i guest.
 */
export function isMatchRadarProAccess(
  ctx: ApiAccessContext,
  subscriptionTier?: SubscriptionTier
): boolean {
  if (ctx.role === "admin" || ctx.role === "pro") return true;
  return subscriptionTier === "pro";
}
