import { Resend } from "resend";
import { env } from "@/lib/env";

export type AuthEmailLocale = "it" | "en";
export type AuthEmailKind = "signup" | "signup_resent" | "recovery";

function resendClient(): Resend | null {
  const apiKey = env.RESEND_API_KEY.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function normalizeAuthEmailLocale(value: unknown): AuthEmailLocale {
  return value === "en" ? "en" : "it";
}

const COPY = {
  it: {
    signupSubject: "PitchBrain — conferma account e scegli la password",
    signupResentSubject: "PitchBrain — nuovo link per completare la registrazione",
    recoverySubject: "PitchBrain — reimposta la password",
    signupTitle: "Conferma il tuo account",
    signupResentTitle: "Completa la registrazione",
    recoveryTitle: "Reimposta la password",
    signupIntro:
      "Benvenuto su PitchBrain. Per attivare il tuo account, apri il link qui sotto e conferma l'email.",
    signupResentIntro:
      "Hai richiesto un nuovo link per completare la registrazione su PitchBrain.",
    recoveryIntro:
      "Hai richiesto di reimpostare la password del tuo account PitchBrain. Apri il link qui sotto per sceglierne una nuova.",
    signupCta: "Conferma e accedi",
    recoveryCta: "Scegli una nuova password",
    copyLink: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Se non hai richiesto tu questa email, puoi ignorarla."
  },
  en: {
    signupSubject: "PitchBrain — confirm your account and set your password",
    signupResentSubject: "PitchBrain — new link to complete registration",
    recoverySubject: "PitchBrain — reset your password",
    signupTitle: "Confirm your account",
    signupResentTitle: "Complete registration",
    recoveryTitle: "Reset your password",
    signupIntro:
      "Welcome to PitchBrain. To activate your account, open the link below and confirm your email.",
    signupResentIntro: "You asked for a new link to complete your PitchBrain registration.",
    recoveryIntro:
      "You asked to reset your PitchBrain password. Open the link below to choose a new one.",
    signupCta: "Confirm and sign in",
    recoveryCta: "Choose a new password",
    copyLink: "If the button does not work, copy and paste this link into your browser:",
    ignore: "If you did not request this email, you can ignore it."
  }
} as const;

function authEmailHtml(kind: AuthEmailKind, actionLink: string, locale: AuthEmailLocale): string {
  const copy = COPY[locale];
  const title =
    kind === "recovery"
      ? copy.recoveryTitle
      : kind === "signup_resent"
        ? copy.signupResentTitle
        : copy.signupTitle;
  const intro =
    kind === "recovery"
      ? copy.recoveryIntro
      : kind === "signup_resent"
        ? copy.signupResentIntro
        : copy.signupIntro;
  const cta = kind === "recovery" ? copy.recoveryCta : copy.signupCta;
  const lang = locale === "en" ? "en" : "it";

  return `<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0891b2">PitchBrain</p>
    <h1 style="margin:0 0 12px;font-size:22px;color:#0e7490">${title}</h1>
    <p style="margin:0 0 20px;color:#475569">${intro}</p>
    <p style="margin:0 0 24px">
      <a href="${actionLink}" style="display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px">
        ${cta}
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b">${copy.copyLink}<br><span style="word-break:break-all">${actionLink}</span></p>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">${copy.ignore}</p>
  </div>
</body>
</html>`;
}

function subjectFor(kind: AuthEmailKind, locale: AuthEmailLocale): string {
  const copy = COPY[locale];
  if (kind === "recovery") return copy.recoverySubject;
  if (kind === "signup_resent") return copy.signupResentSubject;
  return copy.signupSubject;
}

export type SendAuthEmailResult =
  | { ok: true }
  | { ok: false; error: "email_not_configured" | "send_failed"; message: string };

export async function sendAuthEmail(params: {
  to: string;
  actionLink: string;
  kind: AuthEmailKind;
  locale?: AuthEmailLocale;
}): Promise<SendAuthEmailResult> {
  const locale = params.locale ?? "it";
  const client = resendClient();
  if (!client) {
    return {
      ok: false,
      error: "email_not_configured",
      message:
        locale === "en"
          ? "Email sending is not configured on the server. Contact support or try again later."
          : "Invio email non configurato sul server. Contatta il supporto o riprova più tardi."
    };
  }

  const { error } = await client.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to: params.to,
    subject: subjectFor(params.kind, locale),
    html: authEmailHtml(params.kind, params.actionLink, locale)
  });

  if (error) {
    console.error("[auth-email] resend_failed", { to: params.to, kind: params.kind, message: error.message });
    return {
      ok: false,
      error: "send_failed",
      message:
        locale === "en"
          ? "We could not send the email. Please try again in a few minutes."
          : "Non siamo riusciti a inviare l'email. Riprova tra qualche minuto."
    };
  }

  return { ok: true };
}

export async function sendSignupEmail(
  to: string,
  actionLink: string,
  resent: boolean,
  locale: AuthEmailLocale = "it"
): Promise<SendAuthEmailResult> {
  return sendAuthEmail({
    to,
    actionLink,
    kind: resent ? "signup_resent" : "signup",
    locale
  });
}

export async function sendPasswordResetEmail(
  to: string,
  actionLink: string,
  locale: AuthEmailLocale = "it"
): Promise<SendAuthEmailResult> {
  return sendAuthEmail({ to, actionLink, kind: "recovery", locale });
}
