import type { ApiAccessContext } from "@/lib/auth/resolve-api-access";
import {
  buildUserEntitlements,
  emptyGuestEntitlements,
  isMatchUnlocked,
  type UserEntitlements
} from "@/lib/entitlements";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";
import { isValidDeviceId } from "@/lib/entitlements/subject";

export function readDeviceIdFromRequest(request: Request): string | null {
  const header = request.headers.get("x-device-id")?.trim();
  if (header && isValidDeviceId(header)) return header;
  return null;
}

export async function resolveRequestEntitlements(
  ctx: ApiAccessContext,
  request?: Request
): Promise<UserEntitlements> {
  const deviceId = request ? readDeviceIdFromRequest(request) : null;
  const beta = isBetaFreeForAllRequest(request, ctx.userId);

  if (!ctx.userId && !deviceId) {
    /** Beta app mobile: anche senza identificativo, un guest ottiene lo stesso accesso Pro. */
    return beta ? { ...emptyGuestEntitlements(), subscriptionTier: "pro" } : emptyGuestEntitlements();
  }

  const entitlements = await buildUserEntitlements({
    userId: ctx.userId,
    deviceId,
    role: ctx.role === "guest" ? "guest" : ctx.role
  });

  /** Beta pubblica app mobile: sblocca tutto per guest e utenti Free, senza toccare il
   * kiosk web (che non invia l'header client mobile). */
  if (beta && entitlements.subscriptionTier !== "pro") {
    return { ...entitlements, subscriptionTier: "pro" };
  }

  return entitlements;
}

export function requestHasMatchUnlock(
  entitlements: UserEntitlements,
  matchId: string | number
): boolean {
  if (entitlements.subscriptionTier === "pro") return true;
  return isMatchUnlocked(entitlements.unlockedMatches, matchId);
}
