import { getOrCreateDeviceId } from "@/lib/device-id";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";

/** Timeout letture UI. 25s copre cold start Vercel + menu calendario da database. */
export const USER_API_TIMEOUT_MS = 25_000;
export const AUTH_BOOT_TIMEOUT_MS = 4_000;

export async function getSessionSafely() {
  try {
    return await withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS, "auth_timeout");
  } catch {
    return { data: { session: null }, error: null };
  }
}

export async function buildMobileHeaders(requireAuth = false): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    getSessionSafely(),
    getOrCreateDeviceId()
  ]);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Device-Id": deviceId,
    "X-PitchBrain-Client": "mobile"
  };

  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (requireAuth) {
    throw new Error("not_authenticated");
  }

  return headers;
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = USER_API_TIMEOUT_MS
): Promise<Response> {
  const controller = init?.signal ? null : new AbortController();
  const abortTimer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await withTimeout(
      fetch(url, {
        ...init,
        signal: init?.signal ?? controller?.signal
      }),
      timeoutMs + 400,
      "timeout"
    );
  } finally {
    if (abortTimer) clearTimeout(abortTimer);
  }
}
