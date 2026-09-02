import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { APP_LOCALES, type AppLocale, setActiveLocale } from "@/lib/i18n";
import { t as translate } from "@/lib/i18n";

const STORAGE_KEY = "pitchbrain.locale";

type Translate = (path: string, params?: Record<string, string | number>) => string;

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "it",
  setLocale: () => undefined,
  t: (path, params) => translate(path, params, "it")
});

function isAppLocale(value: string | null): value is AppLocale {
  return value === "it" || value === "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("it");

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !isAppLocale(stored)) return;
        setActiveLocale(stored);
        setLocaleState(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    if (!APP_LOCALES.includes(next)) return;
    setActiveLocale(next);
    setLocaleState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const t = useCallback<Translate>((path, params) => translate(path, params, locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
