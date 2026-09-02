"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  AUTH_WEB_COPY,
  normalizeAuthWebLocale,
  resolveAuthWebLocale,
  type AuthWebLocale
} from "@/lib/auth/web-locale";

export function useAuthWebLocale() {
  const searchParams = useSearchParams();
  const [locale, setLocaleState] = useState<AuthWebLocale>(() =>
    resolveAuthWebLocale({ searchParams })
  );

  useEffect(() => {
    const fromUrl = resolveAuthWebLocale({ searchParams });
    if (searchParams.get("locale") === "en" || searchParams.get("locale") === "it") {
      setLocaleState(fromUrl);
      return;
    }
    if (searchParams.get("next")?.includes("locale=")) {
      setLocaleState(fromUrl);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      setLocaleState(
        resolveAuthWebLocale({
          searchParams,
          metadataLocale: data.user?.user_metadata?.locale,
          browserLanguage: navigator.language
        })
      );
    });
  }, [searchParams]);

  const setLocale = useCallback((next: AuthWebLocale) => {
    setLocaleState(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("locale", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const copy = useMemo(() => AUTH_WEB_COPY[locale], [locale]);

  return { locale, setLocale, copy };
}

export function AuthLocaleToggle({
  locale,
  onChange
}: {
  locale: AuthWebLocale;
  onChange: (locale: AuthWebLocale) => void;
}) {
  return (
    <div className="mb-4 flex gap-2">
      <button
        type="button"
        onClick={() => onChange("it")}
        className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
          locale === "it" ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300"
        }`}
      >
        Italiano
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
          locale === "en" ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300"
        }`}
      >
        English
      </button>
    </div>
  );
}

export function authWelcomePath(locale: AuthWebLocale = "it"): string {
  return `/account/welcome?locale=${normalizeAuthWebLocale(locale)}`;
}
