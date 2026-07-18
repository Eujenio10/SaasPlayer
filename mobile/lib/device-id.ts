import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "pitchbrain_device_id_v1";

function randomId(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** ID dispositivo stabile per guest entitlements / rADS (anti-abuse soft). */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) return existing;
    const next = `d_${randomId()}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return `d_${randomId()}`;
  }
}
