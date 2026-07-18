import type { DifficultMarkingsSnapshot } from "@/lib/difficult-markings/types";

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { snapshot: DifficultMarkingsSnapshot; expiresAt: number }>();

export function rememberDifficultMarkingsSnapshot(
  organizationId: string,
  snapshot: DifficultMarkingsSnapshot
): void {
  cache.set(organizationId.trim(), {
    snapshot,
    expiresAt: Date.now() + TTL_MS
  });
}

export function readDifficultMarkingsSnapshotFromMemory(
  organizationId: string
): DifficultMarkingsSnapshot | null {
  const entry = cache.get(organizationId.trim());
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(organizationId.trim());
    return null;
  }
  return entry.snapshot;
}

export function invalidateDifficultMarkingsSnapshotMemory(organizationId?: string): void {
  if (organizationId) cache.delete(organizationId.trim());
  else cache.clear();
}
