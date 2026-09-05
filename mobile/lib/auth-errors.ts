import type { AuthError } from "@supabase/supabase-js";

type AuthErrorShape = {
  message: string;
  code: string;
  status: string;
};

function readString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseDumpedFetchError(raw: string): Partial<AuthErrorShape> {
  if (!raw.includes("x-sb-error-code") && !raw.includes("supabase.co/auth")) {
    return {};
  }
  const status = raw.match(/"status":(\d+)/)?.[1] ?? "";
  const code = raw.match(/x-sb-error-code":"([^"]+)"/)?.[1] ?? "";
  const path = raw.match(/supabase\.co(\/auth\/[^"]+)/)?.[1] ?? "/auth/v1/signup";
  return {
    status,
    code,
    message: `Supabase ${path} ha risposto ${status || "errore"} (${code || "unexpected_failure"})`
  };
}

export function describeAuthError(error: unknown): AuthErrorShape {
  if (error instanceof Error) {
    const extra = error as Error & { code?: unknown; status?: unknown; cause?: unknown };
    const dumped = parseDumpedFetchError(error.message);
    const fromCause =
      extra.cause instanceof Error
        ? extra.cause.message
        : extra.cause && typeof extra.cause === "object"
          ? readString((extra.cause as { message?: unknown }).message)
          : readString(extra.cause);
    return {
      message: dumped.message || error.message || fromCause || error.name,
      code: dumped.code || readString(extra.code),
      status: dumped.status || (extra.status != null ? String(extra.status) : "")
    };
  }

  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    const nested =
      o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : null;
    return {
      message:
        readString(o.message) ||
        readString(o.msg) ||
        readString(nested?.message) ||
        (typeof o.error === "string" ? o.error : "") ||
        JSON.stringify(o),
      code: readString(o.code) || readString(o.error_code) || readString(nested?.code),
      status: o.status != null ? String(o.status) : nested?.status != null ? String(nested.status) : ""
    };
  }

  return { message: String(error ?? "unknown"), code: "", status: "" };
}

export function mapAuthError(error: AuthError | Error | unknown): string {
  const info = describeAuthError(error);
  const code = info.code.toLowerCase();
  const message = info.message.toLowerCase();
  const errorName = error instanceof Error ? error.name : "";

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("rate_limit")
  ) {
    return "Troppe email inviate. Attendi qualche minuto e riprova.";
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("user already registered")
  ) {
    return "Questa email è già registrata. Accedi o recupera la password.";
  }

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email o password errate.";
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Conferma prima la tua email. Controlla la posta o richiedi un nuovo invio.";
  }

  if (
    code === "signup_disabled" ||
    message.includes("signups not allowed") ||
    message.includes("signup not allowed")
  ) {
    return "La registrazione non è attiva. Contatta support@pitchbrain.it.";
  }

  if (
    (message.includes("redirect") || message.includes("redirect_to") || code === "validation_failed") &&
    !message.includes("email")
  ) {
    return "Configurazione redirect non valida. Verifica gli URL in Supabase → URL Configuration.";
  }

  if (
    code === "unexpected_failure" ||
    info.status === "500" ||
    errorName === "AuthRetryableFetchError" ||
    message.includes("unexpected_failure") ||
    message.includes("error sending") ||
    message.includes("confirmation email") ||
    message.includes("smtp") ||
    message.includes("mail") ||
    message.includes("hook") ||
    message.includes("database error") ||
    message.includes("saving new user")
  ) {
    return "Invio email non riuscito. Controlla SMTP Aruba (no-reply@pitchbrain.it) e che l'hook Send Email sia spento.";
  }

  if (
    code === "weak_password" ||
    (message.includes("password") &&
      (message.includes("weak") || message.includes("short") || message.includes("at least")))
  ) {
    return "La password è troppo debole. Usa almeno 8 caratteri.";
  }

  if (message.includes("invalid email") || code === "email_address_invalid") {
    return "Indirizzo email non valido.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "Connessione non riuscita. Controlla internet e riprova.";
  }

  if (message.includes("timeout") || message === "auth_timeout" || message === "signout_timeout") {
    return "Connessione lenta. Riprova tra poco.";
  }

  if (
    code === "flow_state_expired" ||
    code === "otp_expired" ||
    message.includes("expired") ||
    message.includes("invalid grant") ||
    message.includes("flow state")
  ) {
    return "Link scaduto o già usato. Richiedi un nuovo invio dall'app.";
  }

  if (message.includes("code verifier") || message.includes("pkce")) {
    return "Apri il link sullo stesso dispositivo dove hai richiesto l'email, oppure richiedine uno nuovo.";
  }

  return "Operazione non riuscita. Riprova tra qualche istante.";
}
