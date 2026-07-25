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

  if (message.includes("password") && message.includes("weak")) {
    return "La password è troppo debole. Usa almeno 8 caratteri.";
  }

  if (message.includes("invalid email")) {
    return "Indirizzo email non valido.";
  }

  if (message.includes("signup is disabled")) {
    return "La registrazione non è al momento disponibile.";
  }

  return "Operazione non riuscita. Riprova tra qualche istante.";
}
