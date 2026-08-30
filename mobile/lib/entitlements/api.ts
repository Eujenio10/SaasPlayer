import { env } from "@/lib/env";
import { buildMobileHeaders, fetchWithTimeout } from "@/lib/mobile-http";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { UserEntitlements, UnlockMatchResult } from "@/lib/entitlements-types";

export async function fetchUserEntitlements(): Promise<UserEntitlements> {
  const deviceId = await getOrCreateDeviceId();
  const res = await fetchWithTimeout(
    `${env.apiUrl}/api/mobile/user/entitlements?deviceId=${encodeURIComponent(deviceId)}&_=${Date.now()}`,
    {
      headers: await buildMobileHeaders(),
      cache: "no-store"
    }
  );
  if (!res.ok) throw new Error("entitlements_fetch_failed");
  return (await res.json()) as UserEntitlements;
}

export async function postUnlockMatchWithRewardedAd(params: {
  matchId: number;
  rewardConfirmed: boolean;
  adTransactionId?: string;
  sourceScreen?: string;
}): Promise<UnlockMatchResult> {
  const deviceId = await getOrCreateDeviceId();
  const res = await fetchWithTimeout(`${env.apiUrl}/api/mobile/user/entitlements/unlock-match`, {
    method: "POST",
    headers: await buildMobileHeaders(),
    body: JSON.stringify({
      matchId: params.matchId,
      rewardConfirmed: params.rewardConfirmed,
      adTransactionId: params.adTransactionId,
      deviceId,
      sourceScreen: params.sourceScreen
    })
  });
  const body = (await res.json().catch(() => null)) as UnlockMatchResult | null;
  if (!body) throw new Error("unlock_match_failed");
  return body;
}
