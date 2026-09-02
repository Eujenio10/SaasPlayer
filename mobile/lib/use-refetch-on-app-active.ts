import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Rilancia `onActive` quando l'app torna in primo piano (es. dopo un refresh dal PC).
 * I tab Expo restano montati: senza questo i dati restano quelli del primo fetch.
 * Throttle: un resume ogni pochi secondi altrimenti Home, Analisi, Marcature e Trend
 * partono insieme e il timeout svuota le schermate.
 */
export function useRefetchOnAppActive(onActive: () => void): void {
  const callbackRef = useRef(onActive);
  callbackRef.current = onActive;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastFiredAtRef = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackgrounded =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = next;
      if (wasBackgrounded && next === "active") {
        const now = Date.now();
        if (now - lastFiredAtRef.current < 90_000) return;
        lastFiredAtRef.current = now;
        callbackRef.current();
      }
    });
    return () => sub.remove();
  }, []);
}
