import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";
import { cancelAlert, recountAndSyncActiveMatch } from "@/lib/live-alerts/persist";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const params = await Promise.resolve(context.params);
  const fixtureId = await cancelAlert(user.id, params.id);
  if (!fixtureId) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE_HEADERS });
  }
  await recountAndSyncActiveMatch(fixtureId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
