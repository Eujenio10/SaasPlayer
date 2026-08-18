import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { resolveAuthenticatedUserAccess } from "@/lib/auth/consumer-membership";
import { buildUnlimitedMatchUsage } from "@/lib/auth/user-access";
import { isBetaFreeForAllRequest } from "@/lib/entitlements/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const access = await resolveAuthenticatedUserAccess(user.id);

  /** Beta pubblica app mobile: rimuove i limiti Pro (quota settimanali, righe Top 10
   * ammonizioni) SOLO per l'app mobile, mai per il kiosk web (Tactical Intelligence Hub),
   * che non invia l'header client mobile. */
  const betaAccess =
    isBetaFreeForAllRequest(request) && !access.isPro
      ? {
          ...access,
          isPro: true,
          canRefreshData: access.canRefreshData,
          matchUsage: buildUnlimitedMatchUsage(),
          yellowCardVisibleRows: null
        }
      : access;

  return NextResponse.json(betaAccess, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
