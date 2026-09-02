export type AuthWebLocale = "it" | "en";

export const AUTH_WEB_COPY = {
  it: {
    confirmingTitle: "Conferma account",
    confirmingBody: "Stiamo confermando il tuo account…",
    loading: "Caricamento…",
    linkExpired: "Link scaduto o già usato. Richiedi un nuovo invio dall'app PitchBrain.",
    missingToken:
      "Non riusciamo a confermare l'account. Riprova a premere il link nell'email, oppure richiedi un nuovo invio.",
    invalidLink: "Link non valido o scaduto. Richiedi un nuovo invio dall'app.",
    confirmFailed: "Non riusciamo a confermare l'account. Richiedi un nuovo invio dall'app.",
    welcomeTitle: "Account pronto",
    welcomeBody:
      "Il tuo account è attivo. Apri l'app PitchBrain sul telefono, vai su Accedi e usa la stessa email e password.",
    welcomeClose: "Puoi chiudere questa pagina del browser.",
    setPasswordTitle: "Scegli la password",
    setPasswordBody:
      "Ultimo passo: imposta la password del tuo account. Poi torna sull'app mobile e accedi.",
    preparing: "Preparazione account PitchBrain…",
    newPassword: "Nuova password",
    confirmPassword: "Conferma password",
    savePassword: "Salva password",
    saving: "Salvataggio…",
    passwordMin: "La password deve avere almeno 8 caratteri.",
    passwordMismatch: "Le password non coincidono.",
    passwordSaveFailed: "Impossibile salvare la password. Riprova."
  },
  en: {
    confirmingTitle: "Confirm account",
    confirmingBody: "Confirming your account…",
    loading: "Loading…",
    linkExpired: "This link has expired or was already used. Request a new one from the PitchBrain app.",
    missingToken:
      "We could not confirm the account. Open the link in the email again, or request a new one.",
    invalidLink: "This link is invalid or has expired. Request a new one from the app.",
    confirmFailed: "We could not confirm the account. Request a new email from the app.",
    welcomeTitle: "Account ready",
    welcomeBody:
      "Your account is active. Open the PitchBrain app on your phone, go to Sign in, and use the same email and password.",
    welcomeClose: "You can close this browser page.",
    setPasswordTitle: "Choose your password",
    setPasswordBody: "Last step: set your account password. Then go back to the mobile app and sign in.",
    preparing: "Preparing your PitchBrain account…",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    savePassword: "Save password",
    saving: "Saving…",
    passwordMin: "Password must be at least 8 characters.",
    passwordMismatch: "Passwords do not match.",
    passwordSaveFailed: "Could not save the password. Please try again."
  }
} as const;

export function normalizeAuthWebLocale(value: unknown): AuthWebLocale {
  return value === "en" ? "en" : "it";
}

export function resolveAuthWebLocale(input: {
  searchParams?: URLSearchParams | { get(name: string): string | null };
  metadataLocale?: unknown;
  browserLanguage?: string;
}): AuthWebLocale {
  const query = input.searchParams?.get("locale") ?? input.searchParams?.get("lang");
  if (query === "en" || query === "it") return query;

  const next = input.searchParams?.get("next") ?? "";
  if (/[?&]locale=en(?:&|$)/.test(next) || /[?&]lang=en(?:&|$)/.test(next)) return "en";
  if (/[?&]locale=it(?:&|$)/.test(next) || /[?&]lang=it(?:&|$)/.test(next)) return "it";
  if (next.includes("locale=en") || next.includes("lang=en")) return "en";

  if (input.metadataLocale === "en" || input.metadataLocale === "it") {
    return input.metadataLocale;
  }

  if (input.browserLanguage?.toLowerCase().startsWith("en")) return "en";
  return "it";
}
