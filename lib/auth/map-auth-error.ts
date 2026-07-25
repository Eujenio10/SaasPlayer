import type { AuthError } from "@supabase/supabase-js";

export function mapAuthError(error: AuthError | Error): string {
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = error.message.toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("rate_limit")
  ) {
    return "Troppe email inviate. Attendi qualche minuto e riprova.";
  }

  if (
    code === "user_already_exists" ||
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

  if (message.includes("redirect") || message.includes("redirect_to")) {
    return "URL di redirect non autorizzato. Aggiungilo in Supabase → URL Configuration.";
  }

  if (
    message.includes("error sending") ||
    message.includes("confirmation email") ||
    message.includes("smtp")
  ) {
    return "Invio email non riuscito. Verifica SMTP Aruba in Supabase.";
  }

  return "Operazione non riuscita. Riprova tra qualche istante.";
}

export function webAuthRedirectTo(next = "/"): string {
  if (typeof window === "undefined") return "/auth/confirm";
  const origin = window.location.origin.replace(/\/$/, "");
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}
