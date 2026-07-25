"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/set-password";
  return value;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Stiamo confermando il tuo account…");

  useEffect(() => {
    const next = safeNextPath(searchParams.get("next"));
    const inviteError = searchParams.get("error");

    if (inviteError) {
      setMessage(
        "Link non valido o scaduto. Torna sull'app PitchBrain e richiedi un nuovo invito."
      );
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
            setMessage("Non siamo riusciti a confermare l'account. Richiedi un nuovo invito.");
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
          setMessage("Link scaduto o già usato. Richiedi un nuovo invito dall'app PitchBrain.");
          return;
        }
        router.replace(next);
        return;
      }

      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type");
      if (tokenHash) {
        const otpType = type ?? (next === "/set-password" ? "recovery" : "signup");
        window.location.href = `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(otpType)}&next=${encodeURIComponent(next)}`;
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        router.replace(next);
        return;
      }

      setMessage(
        "Apri di nuovo il link nell'email di invito PitchBrain. Se non funziona, richiedi un nuovo invito dall'app."
      );
    }

    void completeAuth();
  }, [router, searchParams]);

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">PitchBrain</p>
        <h1 className="mt-2 text-2xl font-bold text-cyan-300">Conferma account</h1>
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
          <p className="text-slate-300">Caricamento…</p>
        </section>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
