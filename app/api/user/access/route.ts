import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { resolveAuthenticatedUserAccess } from "@/lib/auth/consumer-membership";
import { stripProPlanForMobileApp } from "@/lib/auth/user-access";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const access = await resolveAuthenticatedUserAccess(user.id);
  const payload = isBetaFreeForAllRequest(request) ? stripProPlanForMobileApp(access) : access;

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
