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

  if (
    message.includes("redirect") ||
    message.includes("redirect_to") ||
    code === "validation_failed"
  ) {
    return "Configurazione redirect non valida. Verifica che pitchbrain://auth/callback sia in Supabase.";
  }

  if (
    message.includes("error sending") ||
    message.includes("confirmation email") ||
    message.includes("smtp") ||
    message.includes("mail")
  ) {
    return "Invio email non riuscito. Verifica SMTP Aruba in Supabase o riprova tra poco.";
  }

  if (message.includes("password") && (message.includes("weak") || message.includes("short"))) {
    return "La password è troppo debole. Usa almeno 8 caratteri.";
  }

  if (message.includes("invalid email")) {
    return "Indirizzo email non valido.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "Connessione non riuscita. Controlla internet e riprova.";
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
