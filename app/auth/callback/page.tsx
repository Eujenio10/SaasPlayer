"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLocaleToggle, useAuthWebLocale } from "@/components/account/auth-web-locale";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/set-password";
  return value;
}

type CallbackStatus =
  | "confirming"
  | "linkExpired"
  | "missingToken"
  | "invalidLink"
  | "confirmFailed";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, setLocale, copy } = useAuthWebLocale();
  const [status, setStatus] = useState<CallbackStatus>("confirming");

  useEffect(() => {
    const next = safeNextPath(searchParams.get("next"));
    const urlError = searchParams.get("error");
    if (urlError === "exchange_failed" || urlError === "verify_failed") {
      setStatus("linkExpired");
      return;
    }
    if (urlError === "missing_token") {
      setStatus("missingToken");
      return;
    }
    if (urlError) {
      setStatus("invalidLink");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    async function completeAuth() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) {
            setStatus("confirmFailed");
            return;
          }
          window.history.replaceState({}, "", window.location.pathname + window.location.search);
          router.replace(next);
          return;
        }
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("linkExpired");
          return;
        }
        router.replace(next);
        return;
      }

      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
      if (tokenHash) {
        const type = searchParams.get("type") ?? (next.startsWith("/set-password") ? "recovery" : "signup");
        window.location.href = `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`;
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        router.replace(next);
        return;
      }

      setStatus("missingToken");
    }

    void completeAuth();
  }, [router, searchParams]);

  const message =
    status === "confirming"
      ? copy.confirmingBody
      : status === "linkExpired"
        ? copy.linkExpired
        : status === "missingToken"
          ? copy.missingToken
          : status === "confirmFailed"
            ? copy.confirmFailed
            : copy.invalidLink;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <AuthLocaleToggle locale={locale} onChange={setLocale} />
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">PitchBrain</p>
        <h1 className="mt-2 text-2xl font-bold text-cyan-300">{copy.confirmingTitle}</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{message}</p>
      </div>
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
          <p className="text-slate-300">Loading…</p>
        </section>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
