import * as SecureStore from "expo-secure-store";

/** Sblocco Guest condiviso: Simulatore match + Duelli da monitorare. */
export type GuestAdPreviewScope = "features";

export const GUEST_FEATURES_PREVIEW_TTL_MS = 15 * 60 * 1000;

export const GUEST_FEATURES_UNLOCK_TITLE = "Funzioni sbloccate";

export const GUEST_FEATURES_UNLOCK_MESSAGE =
  "Simulatore match e Duelli da monitorare sono disponibili per i prossimi 15 minuti.";

const SCOPE_STORAGE_KEY = "pitchbrain_guest_ad_features_expires";

const LEGACY_KEYS = [
  "pitchbrain_guest_ad_preview_expires",
  "pitchbrain_guest_ad_simulator_expires"
];

async function readExpiresAtFromKey(key: string): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await SecureStore.deleteItemAsync(key);
      return null;
    }
    return expiresAt;
  } catch {
    return null;
  }
}

export async function readGuestFeaturesPreviewExpiresAt(): Promise<number | null> {
  const primary = await readExpiresAtFromKey(SCOPE_STORAGE_KEY);
  if (primary != null) return primary;

  let best: number | null = null;
  for (const legacyKey of LEGACY_KEYS) {
    const expiresAt = await readExpiresAtFromKey(legacyKey);
    if (expiresAt != null && (best == null || expiresAt > best)) {
      best = expiresAt;
    }
  }
  if (best != null) {
    await SecureStore.setItemAsync(SCOPE_STORAGE_KEY, String(best));
  }
  return best;
}

export async function readGuestAdPreviewActive(
  _scope: GuestAdPreviewScope = "features"
): Promise<boolean> {
  const expiresAt = await readGuestFeaturesPreviewExpiresAt();
  return expiresAt != null;
}

export async function activateGuestAdPreview(
  _scope: GuestAdPreviewScope = "features"
): Promise<number> {
  const expiresAt = Date.now() + GUEST_FEATURES_PREVIEW_TTL_MS;
  await SecureStore.setItemAsync(SCOPE_STORAGE_KEY, String(expiresAt));
  await Promise.all(LEGACY_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
  return expiresAt;
}

export async function clearGuestAdPreview(_scope?: GuestAdPreviewScope): Promise<void> {
  await SecureStore.deleteItemAsync(SCOPE_STORAGE_KEY);
  await Promise.all(LEGACY_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

export function formatGuestFeaturesRemainingMinutes(expiresAt: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 60_000));
}
