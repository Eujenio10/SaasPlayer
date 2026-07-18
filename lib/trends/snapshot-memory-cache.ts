const cache = new Map<string, import("@/lib/trends/types").TrendsSnapshot>();

export function rememberTrendsSnapshot(
  organizationId: string,
  snapshot: import("@/lib/trends/types").TrendsSnapshot
): void {
  cache.set(organizationId.trim(), snapshot);
}

export function readTrendsSnapshotFromMemory(
  organizationId: string
): import("@/lib/trends/types").TrendsSnapshot | null {
  return cache.get(organizationId.trim()) ?? null;
}

export function invalidateTrendsSnapshotMemory(organizationId?: string): void {
  if (organizationId) cache.delete(organizationId.trim());
  else cache.clear();
}
