import type { ApiAccessContext } from "@/lib/auth/resolve-api-access";
import {
  buildUserEntitlements,
  emptyGuestEntitlements,
  isMatchUnlocked,
  type UserEntitlements
} from "@/lib/entitlements";
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
  if (!ctx.userId && !deviceId) return emptyGuestEntitlements();
  return buildUserEntitlements({
    userId: ctx.userId,
    deviceId,
    role: ctx.role === "guest" ? "guest" : ctx.role
  });
}

export function requestHasMatchUnlock(
  entitlements: UserEntitlements,
  matchId: string | number
): boolean {
  if (entitlements.subscriptionTier === "pro") return true;
  return isMatchUnlocked(entitlements.unlockedMatches, matchId);
}
