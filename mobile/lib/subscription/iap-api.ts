import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { getOrCreateDeviceId } from "@/lib/device-id";

async function buildHeaders(): Promise<HeadersInit> {
  const [{ data }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId()
  ]);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId
  };
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

/** Sincronizza stato Pro IAP (App Store / Play) sul backend. */
export async function syncIapProSubscription(params: {
  active: boolean;
  expiresAt?: string | null;
  productId?: string | null;
  provider?: "app_store" | "play_store" | "revenuecat" | "mock";
}): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/subscriptions/iap-sync`, {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({
      active: params.active,
      expiresAt: params.expiresAt ?? null,
      productId: params.productId ?? null,
      provider: params.provider ?? "revenuecat"
    })
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok) {
    return { ok: false, message: body?.error ?? "iap_sync_failed" };
  }
  return { ok: true };
}
