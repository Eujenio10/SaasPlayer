"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mapAuthError, webAuthRedirectTo } from "@/lib/auth/map-auth-error";

type AuthMode = "login" | "register" | "recover";

interface AuthPanelProps {
  initialMode?: AuthMode;
  nextPath?: string;
  error?: string;
}

const RESEND_COOLDOWN_SEC = 60;

const registerSteps = [
  "Inserisci email e password",
  "Conferma dall'email che ti inviamo",
  "Accedi a PitchBrain"
];

export function AuthPanel({ initialMode = "login", nextPath = "/", error }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formError, setFormError] = useState<string | null>(
    error ? "Credenziali non valide. Controlla email e password." : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [registerSent, setRegisterSent] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setFormError(null);
    setInfo(null);
    setRegisterSent(false);
    setRecoverSent(false);
    setConfirmPassword("");
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setInfo(null);

    if (password.length < 8) {
      setFormError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Le password non coincidono.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: webAuthRedirectTo(nextPath) }
      });
      if (signUpError) {
        setFormError(mapAuthError(signUpError));
        return;
      }
      if (data.user?.identities?.length === 0) {
        switchMode("login");
        setFormError("Questa email è già registrata. Accedi o recupera la password.");
        return;
      }
      setRegisterSent(true);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setInfo(
        "Ti abbiamo inviato un'email di conferma. Apri il link per attivare l'account, poi accedi."
      );
    } catch {
      setFormError("Connessione non riuscita. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecover(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: webAuthRedirectTo("/set-password")
      });
      if (resetError) {
        setFormError(mapAuthError(resetError));
        return;
      }
      setRecoverSent(true);
      setInfo("Ti abbiamo inviato un'email con le istruzioni per reimpostare la password.");
    } catch {
      setFormError("Connessione non riuscita. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending || !email.trim()) return;
    setFormError(null);
    setResending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: webAuthRedirectTo(nextPath) }
      });
      if (resendError) {
        setFormError(mapAuthError(resendError));
        return;
      }
      setInfo("Email di conferma reinviata. Controlla posta in arrivo e spam.");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } finally {
      setResending(false);
    }
  }

  const title =
    mode === "recover"
      ? recoverSent
        ? "Controlla la email"
        : "Recupera password"
      : mode === "login"
        ? "Accedi"
        : registerSent
          ? "Controlla la email"
          : "Crea account";

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-md items-center px-2 sm:px-0">
      <div className="w-full rounded-2xl border border-cyan-300/25 bg-graphite/85 p-6 shadow-broadcast sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/75">PitchBrain</p>
        <h1 className="mt-2 text-2xl font-bold text-cyan-300 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {mode === "recover"
            ? recoverSent
              ? "Apri il link nell'email per scegliere una nuova password."
              : "Inserisci l'email dell'account: ti invieremo un link di reset."
            : mode === "login"
              ? "Analisi tattica, sblocchi e abbonamento Pro con lo stesso account."
              : registerSent
                ? "Apri il link di conferma nell'email per attivare l'account."
                : "Gratis. Conferma l'email per completare la registrazione."}
        </p>

        {mode !== "recover" && !registerSent && !recoverSent ? (
          <div className="mt-5 flex rounded-xl border border-cyan-400/20 bg-darkGray/80 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-cyan-400 text-darkGray"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-cyan-400 text-darkGray"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Registrati
            </button>
          </div>
        ) : null}

        {formError ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        {info ? (
          <p className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100">
            {info}
          </p>
        ) : null}

        {mode === "login" ? (
          <form action="/auth/login" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="nome@email.it"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="La tua password"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <button
              type="button"
              onClick={() => switchMode("recover")}
              className="text-left text-sm text-cyan-300/90 hover:text-cyan-200"
            >
              Password dimenticata?
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-techBlue px-4 py-2.5 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
            >
              Entra in PitchBrain
            </button>
          </form>
        ) : null}

        {mode === "recover" && !recoverSent ? (
          <form onSubmit={(event) => void handleRecover(event)} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="nome@email.it"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full rounded-xl bg-techBlue px-4 py-2.5 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Invio in corso…" : "Invia link di reset"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full text-sm text-slate-400 hover:text-slate-200"
            >
              Torna al login
            </button>
          </form>
        ) : null}

        {mode === "register" && !registerSent ? (
          <form onSubmit={(event) => void handleRegister(event)} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="nome@email.it"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Almeno 8 caratteri"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-300">Conferma password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Ripeti la password"
                className="w-full rounded-xl border border-cyan-400/25 bg-darkGray px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !email.trim() || !password || !confirmPassword}
              className="w-full rounded-xl bg-techBlue px-4 py-2.5 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Registrazione…" : "Crea account"}
            </button>
          </form>
        ) : null}

        {registerSent ? (
          <div className="mt-6 space-y-4">
            <ol className="space-y-3 text-sm text-slate-300">
              {registerSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-300">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending || resendCooldown > 0}
              className="w-full rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-950/30 disabled:opacity-60"
            >
              {resending
                ? "Invio…"
                : resendCooldown > 0
                  ? `Reinvia email tra ${resendCooldown}s`
                  : "Reinvia email di conferma"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-950/30"
            >
              Ho confermato — Accedi
            </button>
          </div>
        ) : null}

        {recoverSent ? (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="mt-6 w-full rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-950/30"
          >
            Torna al login
          </button>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">
          Assistenza:{" "}
          <a href="mailto:support@pitchbrain.it" className="text-cyan-300/80 hover:text-cyan-200">
            support@pitchbrain.it
          </a>
        </p>

        <p className="mt-3 text-center text-xs text-slate-500">
          <Link href="/" className="text-cyan-300/80 hover:text-cyan-200">
            Torna alla home
          </Link>
        </p>
      </div>
    </section>
  );
}
