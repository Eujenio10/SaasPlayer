type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

export function subscribeAdminCatalogRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAdminCatalogRefresh(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}
