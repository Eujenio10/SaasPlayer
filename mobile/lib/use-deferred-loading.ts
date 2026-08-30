import { useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 320;
const DEFAULT_MIN_VISIBLE_MS = 600;

export const DEFERRED_LOADING_DELAY_MS = DEFAULT_DELAY_MS;
export const DEFERRED_LOADING_MIN_VISIBLE_MS = DEFAULT_MIN_VISIBLE_MS;

/**
 * Evita flicker: mostra il loading solo dopo `delayMs`.
 * Se è già visibile, resta almeno `minVisibleMs`.
 */
export function useDeferredLoading(
  loading: boolean,
  options?: { delayMs?: number; minVisibleMs?: number }
): boolean {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const minVisibleMs = options?.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  const shownAtRef = useRef(0);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    if (loading) {
      if (hideRef.current) {
        clearTimeout(hideRef.current);
        hideRef.current = null;
      }
      if (shownRef.current) return;
      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        shownAtRef.current = Date.now();
        setShown(true);
      }, delayMs);
    } else {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (!shownRef.current) return;
      const remaining = Math.max(0, minVisibleMs - (Date.now() - shownAtRef.current));
      hideRef.current = setTimeout(() => {
        hideRef.current = null;
        setShown(false);
      }, remaining);
    }

    return () => {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
    };
  }, [loading, delayMs, minVisibleMs]);

  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  return shown;
}
