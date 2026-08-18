import { env } from "@/lib/env";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { supabase } from "@/lib/supabase";

async function buildHeaders(): Promise<HeadersInit> {
  const [{ data: sessionData }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
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
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }
  return headers;
}

export async function sendAppFeedback(params: {
  message: string;
  contactEmail?: string;
}): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/feedback`, {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({
      message: params.message.trim(),
      contactEmail: params.contactEmail?.trim() || undefined
    })
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message || body.error || "feedback_send_failed");
  }
}
