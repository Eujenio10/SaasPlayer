/** Chiave soggetto entitlement: utente autenticato oppure device guest. */
export function userSubjectKey(userId: string): string {
  return `user:${userId.trim()}`;
}

export function deviceSubjectKey(deviceId: string): string {
  return `device:${deviceId.trim().toLowerCase()}`;
}

export function resolveSubjectKey(params: {
  userId?: string | null;
  deviceId?: string | null;
}): string | null {
  if (params.userId?.trim()) return userSubjectKey(params.userId);
  if (params.deviceId?.trim() && params.deviceId.trim().length >= 8) {
    return deviceSubjectKey(params.deviceId);
  }
  return null;
}

export function isValidDeviceId(deviceId: string | null | undefined): boolean {
  if (!deviceId) return false;
  const id = deviceId.trim();
  // UUID-like o token stabile 8–128 chars alfanumerici/-_
  return /^[a-zA-Z0-9_-]{8,128}$/.test(id);
}
