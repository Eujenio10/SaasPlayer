import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { ensureConsumerOrganizationMembership } from "@/lib/auth/consumer-membership";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { buildUserEntitlements, emptyGuestEntitlements } from "@/lib/entitlements";
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
    return NextResponse.json(emptyGuestEntitlements(), {
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
    return NextResponse.json(entitlements, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  const entitlements = await buildUserEntitlements({
    userId: null,
    deviceId,
    role: "guest"
  });
  return NextResponse.json(entitlements, {
    headers: { "Cache-Control": "no-store" }
  });
}
