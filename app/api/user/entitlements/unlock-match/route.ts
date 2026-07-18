import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { unlockMatchWithRewardedAd } from "@/lib/entitlements";
import { isValidDeviceId } from "@/lib/entitlements/subject";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  matchId: z.coerce.number().int().positive(),
  rewardConfirmed: z.boolean(),
  deviceId: z.string().min(8).max(128).optional(),
  adTransactionId: z.string().min(4).max(200).optional(),
  sourceScreen: z.string().max(80).optional()
});

export async function POST(request: Request) {
  const user = await getApiUser(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const headerDevice = request.headers.get("x-device-id")?.trim();
  const deviceIdRaw = parsed.data.deviceId ?? headerDevice ?? null;
  const deviceId = deviceIdRaw && isValidDeviceId(deviceIdRaw) ? deviceIdRaw : null;

  if (!user && !deviceId) {
    return NextResponse.json({ error: "auth_required", message: "Serve account o deviceId." }, { status: 401 });
  }

  const organization = user ? await getOrganizationContextForUser(user.id) : null;
  const result = await unlockMatchWithRewardedAd({
    userId: user?.id ?? null,
    deviceId,
    matchId: parsed.data.matchId,
    rewardConfirmed: parsed.data.rewardConfirmed,
    adTransactionId: parsed.data.adTransactionId,
    role: organization?.role ?? (user ? "member" : "guest"),
    sourceScreen: parsed.data.sourceScreen
  });

  if (!result.ok) {
    const status =
      result.error === "auth_required"
        ? 401
        : result.error === "daily_limit_reached"
          ? 429
          : result.error === "already_unlocked"
            ? 409
            : result.error === "reward_not_confirmed"
              ? 403
              : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
