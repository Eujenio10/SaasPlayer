import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { ensureConsumerOrganizationMembership } from "@/lib/auth/consumer-membership";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { buildUserEntitlements, emptyGuestEntitlements } from "@/lib/entitlements";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";
import { isValidDeviceId } from "@/lib/entitlements/subject";

export const dynamic = "force-dynamic";

function readDeviceId(request: Request): string | null {
  const header = request.headers.get("x-device-id")?.trim();
  if (header && isValidDeviceId(header)) return header;
  const url = new URL(request.url);
  const q = url.searchParams.get("deviceId")?.trim();
  if (q && isValidDeviceId(q)) return q;
  return null;
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  const deviceId = readDeviceId(request);

  if (!user && !deviceId) {
    const empty = emptyGuestEntitlements();
    const betaEmpty = isBetaFreeForAllRequest(request) ? { ...empty, subscriptionTier: "pro" as const } : empty;
    return NextResponse.json(betaEmpty, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (user) {
    await ensureConsumerOrganizationMembership(user.id);
    const organization = await getOrganizationContextForUser(user.id);
    const entitlements = await buildUserEntitlements({
      userId: user.id,
      deviceId,
      role: organization?.role ?? "member"
    });

    /** Beta pubblica app mobile: tutti gli utenti autenticati Free hanno accesso Pro. */
    const betaEntitlements =
      isBetaFreeForAllRequest(request, user.id) && entitlements.subscriptionTier !== "pro"
        ? { ...entitlements, subscriptionTier: "pro" as const }
        : entitlements;

    return NextResponse.json(betaEntitlements, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  const entitlements = await buildUserEntitlements({
    userId: null,
    deviceId,
    role: "guest"
  });

  /** Beta pubblica app mobile: i guest hanno lo stesso accesso dei Free. */
  const betaEntitlements =
    isBetaFreeForAllRequest(request) && entitlements.subscriptionTier !== "pro"
      ? { ...entitlements, subscriptionTier: "pro" as const }
      : entitlements;

  return NextResponse.json(betaEntitlements, {
    headers: { "Cache-Control": "no-store" }
  });
}
