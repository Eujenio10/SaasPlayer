import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Rilancia `onActive` quando l'app torna in primo piano (es. dopo un refresh dal PC).
 * I tab Expo restano montati: senza questo i dati restano quelli del primo fetch.
 */
export function useRefetchOnAppActive(onActive: () => void): void {
  const callbackRef = useRef(onActive);
  callbackRef.current = onActive;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackgrounded =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = next;
      if (wasBackgrounded && next === "active") {
        callbackRef.current();
      }
    });
    return () => sub.remove();
  }, []);
}
