"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type AuthMode = "login" | "register";

interface AuthPanelProps {
  initialMode?: AuthMode;
  nextPath?: string;
  error?: string;
}

const registerSteps = [
  "Inserisci la tua email",
  "Apri il link che ti inviamo",
  "Scegli la password e accedi all'app"
];

export function AuthPanel({ initialMode = "login", nextPath = "/", error }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error ? "Credenziali non valide. Controlla email e password." : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [registerSent, setRegisterSent] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setFormError(null);
    setInfo(null);
    setRegisterSent(false);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const body = (await res.json()) as {
        ok?: boolean;
        alreadyRegistered?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        const message =
          body.message ??
          (res.status === 429
            ? "Troppe email inviate. Controlla spam o riprova tra circa 60 minuti."
            : "Registrazione non riuscita. Riprova.");
        setFormError(message);
        return;
      }
      if (body.alreadyRegistered) {
        switchMode("login");
        setFormError(body.message ?? "Email già registrata. Accedi con la password.");
        return;
      }
      setRegisterSent(true);
      setInfo(body.message ?? "Email inviata. Controlla la posta.");
    } catch {
      setFormError("Connessione non riuscita. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-md items-center px-2 sm:px-0">
      <div className="w-full rounded-2xl border border-cyan-300/25 bg-graphite/85 p-6 shadow-broadcast sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/75">PitchBrain</p>
        <h1 className="mt-2 text-2xl font-bold text-cyan-300 sm:text-3xl">
          {mode === "login" ? "Accedi" : registerSent ? "Controlla la email" : "Crea account"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {mode === "login"
            ? "Analisi tattica, sblocchi e abbonamento Pro con lo stesso account."
            : registerSent
              ? "Abbiamo inviato le istruzioni. Apri il link sul telefono o sul computer."
              : "Gratis. Ti basta l'email: la password la scegli dal link di conferma."}
        </p>

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

        {formError ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        {info && mode === "register" ? (
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
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-techBlue px-4 py-2.5 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
            >
              Entra in PitchBrain
            </button>
          </form>
        ) : registerSent ? (
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
              onClick={() => switchMode("login")}
              className="w-full rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-950/30"
            >
              Ho impostato la password — Accedi
            </button>
          </div>
        ) : (
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
            <ul className="space-y-2 rounded-xl border border-cyan-400/15 bg-darkGray/50 px-3 py-3 text-xs text-slate-400">
              {registerSteps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold text-cyan-400/80">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full rounded-xl bg-techBlue px-4 py-2.5 font-semibold text-darkGray transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? "Invio in corso…" : "Invia email di registrazione"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Usi l&apos;app mobile?{" "}
          <span className="text-slate-400">Dopo la registrazione torna su PitchBrain e accedi.</span>
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
