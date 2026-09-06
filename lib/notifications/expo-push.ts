import type { ExpoPushMessage } from "@/lib/notifications/types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<{ sent: number; failed: number }> {
  if (!messages.length) return { sent: 0, failed: 0 };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      failed += chunk.length;
      continue;
    }
    const json = (await res.json()) as { data?: Array<{ status?: string }> };
    const rows = Array.isArray(json.data) ? json.data : [];
    for (const row of rows) {
      if (row.status === "ok") sent += 1;
      else failed += 1;
    }
    if (!rows.length) sent += chunk.length;
  }
  return { sent, failed };
}
