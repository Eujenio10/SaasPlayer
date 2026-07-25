"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SetPasswordClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function ensureSession() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          window.history.replaceState({}, "", window.location.pathname);
        }
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/callback?next=/set-password");
        return;
      }

      setReady(true);
      setLoading(false);
    }

    void ensureSession();
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Impossibile salvare la password. Riprova.");
        return;
      }
      router.replace("/account/welcome");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
        <p className="text-slate-300">Preparazione account PitchBrain…</p>
      </section>
    );
  }

  if (!ready) {
    return null;
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">PitchBrain</p>
        <h1 className="mt-2 text-3xl font-bold text-cyan-300">Scegli la password</h1>
        <p className="mt-3 text-slate-300">
          Ultimo passo: imposta la password del tuo account. Poi torna sull&apos;app mobile e accedi.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-darkGray/70 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nuova password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Conferma password</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={8}
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "Salvataggio…" : "Salva password"}
          </button>
        </form>
      </div>
    </section>
  );
}
