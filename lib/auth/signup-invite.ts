import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  normalizeAuthEmailLocale,
  sendPasswordResetEmail,
  sendSignupEmail,
  type AuthEmailLocale
} from "@/lib/email/send-signup-email";

export function signupRedirectTo(locale: AuthEmailLocale = "it"): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${appUrl}/auth/callback?next=${encodeURIComponent(`/set-password?locale=${locale}`)}`;
}

export function passwordResetRedirectTo(locale: AuthEmailLocale = "it"): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${appUrl}/auth/callback?next=${encodeURIComponent(`/set-password?locale=${locale}`)}`;
}

export function isAuthRateLimitError(message: string, status?: number): boolean {
  const lower = message.toLowerCase();
  return status === 429 || lower.includes("rate limit") || lower.includes("rate_limit");
}

/** Utente che ha completato almeno un accesso dopo la registrazione. */
export function isRegistrationComplete(user: User): boolean {
  return Boolean(user.email_confirmed_at && user.last_sign_in_at);
}

/** Invito non finito: email non confermata oppure mai effettuato un login. */
export function isRegistrationIncomplete(user: User): boolean {
  return !isRegistrationComplete(user);
}

function localeMessages(locale: AuthEmailLocale) {
  if (locale === "en") {
    return {
      alreadyRegistered:
        "This email is already registered. Sign in with your password. If you forgot it, use Forgot password on the sign-in screen.",
      resent:
        "We sent you another email to complete registration. Open the link and choose your password.",
      rateLimit:
        "Too many emails sent in a short time. Check inbox and spam, or try again in a few minutes.",
      inviteFailed: "Resend failed. Please try again in a few minutes.",
      registerFailed: "Registration failed. Please try again in a few minutes.",
      sent: "We sent you an email. Open the link to confirm and choose your password, then sign in.",
      resetSent: "We sent you an email with instructions to reset your password."
    };
  }
  return {
    alreadyRegistered:
      "Questa email è già registrata. Accedi con la password. Se l'hai dimenticata, usa Recupera password dal login.",
    resent:
      "Ti abbiamo reinviato l'email per completare la registrazione. Apri il link e scegli la password.",
    rateLimit:
      "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra qualche minuto.",
    inviteFailed: "Reinvio non riuscito. Riprova tra qualche minuto.",
    registerFailed: "Registrazione non riuscita. Riprova tra qualche minuto.",
    sent: "Ti abbiamo inviato un'email. Apri il link per confermare e scegliere la password, poi accedi.",
    resetSent: "Ti abbiamo inviato un'email con le istruzioni per reimpostare la password."
  };
}

export async function findAuthUserByEmail(
  service: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200
    });
    if (error) {
      console.error("[signup-invite] list_users_failed", error.message);
      return null;
    }
    if (!data?.users?.length) return null;

    const user = data.users.find((item) => item.email?.toLowerCase() === target);
    if (user) return user;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function generateAndSendLink(
  service: SupabaseClient,
  params: {
    email: string;
    type: "invite" | "recovery" | "signup";
    redirectTo: string;
    locale: AuthEmailLocale;
    kind: "signup" | "signup_resent" | "recovery";
    password?: string;
  }
): Promise<{ ok: true } | { ok: false; rateLimit?: boolean; skipped?: boolean; message: string }> {
  if (!env.RESEND_API_KEY.trim()) {
    return { ok: false, skipped: true, message: "email_not_configured" };
  }

  const copy = localeMessages(params.locale);
  const payload = {
    type: params.type,
    email: params.email,
    options: { redirectTo: params.redirectTo }
  };
  const { data, error } = params.password
    ? await service.auth.admin.generateLink({ ...payload, password: params.password })
    : await service.auth.admin.generateLink(payload);
  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) {
    if (error && isAuthRateLimitError(error.message, error.status)) {
      return { ok: false, rateLimit: true, message: copy.rateLimit };
    }
    return { ok: false, message: copy.inviteFailed };
  }

  const sent =
    params.kind === "recovery"
      ? await sendPasswordResetEmail(params.email, actionLink, params.locale)
      : await sendSignupEmail(params.email, actionLink, params.kind === "signup_resent", params.locale);

  if (!sent.ok) {
    if (sent.error === "email_not_configured") {
      return { ok: false, message: sent.message };
    }
    return { ok: false, message: sent.message };
  }
  return { ok: true };
}

export type SignupEmailResult =
  | { ok: true; alreadyRegistered: false; resent: boolean; message: string }
  | { ok: true; alreadyRegistered: true; message: string }
  | { ok: false; error: "rate_limit" | "invite_failed"; message: string };

/**
 * Registrazione/reinvio: se Resend è configurato invia il template localizzato,
 * altrimenti usa il mailer Supabase (SMTP Aruba).
 */
export async function sendSignupOrResendEmail(
  service: SupabaseClient,
  email: string,
  localeInput?: unknown
): Promise<SignupEmailResult> {
  const locale = normalizeAuthEmailLocale(localeInput);
  const copy = localeMessages(locale);
  const redirectTo = signupRedirectTo(locale);
  const existing = await findAuthUserByEmail(service, email);

  if (existing && isRegistrationComplete(existing)) {
    return {
      ok: true,
      alreadyRegistered: true,
      message: copy.alreadyRegistered
    };
  }

  if (existing && isRegistrationIncomplete(existing)) {
    const custom = await generateAndSendLink(service, {
      email,
      type: "recovery",
      redirectTo,
      locale,
      kind: "signup_resent"
    });
    if (custom.ok) {
      return { ok: true, alreadyRegistered: false, resent: true, message: copy.resent };
    }
    if (custom.rateLimit) {
      return { ok: false, error: "rate_limit", message: custom.message };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const recovery = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (!recovery.error) {
      return { ok: true, alreadyRegistered: false, resent: true, message: copy.resent };
    }
    if (isAuthRateLimitError(recovery.error.message, recovery.error.status)) {
      return { ok: false, error: "rate_limit", message: copy.rateLimit };
    }
    return { ok: false, error: "invite_failed", message: copy.inviteFailed };
  }

  const customInvite = await generateAndSendLink(service, {
    email,
    type: "invite",
    redirectTo,
    locale,
    kind: "signup"
  });
  if (customInvite.ok) {
    return { ok: true, alreadyRegistered: false, resent: false, message: copy.sent };
  }
  if (customInvite.rateLimit) {
    return { ok: false, error: "rate_limit", message: customInvite.message };
  }

  const invite = await service.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invite.error) {
    if (isAuthRateLimitError(invite.error.message, invite.error.status)) {
      return { ok: false, error: "rate_limit", message: copy.rateLimit };
    }

    const retryUser = await findAuthUserByEmail(service, email);
    if (retryUser && isRegistrationComplete(retryUser)) {
      return { ok: true, alreadyRegistered: true, message: copy.alreadyRegistered };
    }

    return { ok: false, error: "invite_failed", message: copy.registerFailed };
  }

  return {
    ok: true,
    alreadyRegistered: false,
    resent: false,
    message: copy.sent
  };
}

export async function sendLocalizedPasswordResetEmail(
  service: SupabaseClient,
  email: string,
  localeInput?: unknown
): Promise<{ ok: true; message: string } | { ok: false; error: "rate_limit" | "send_failed"; message: string }> {
  const locale = normalizeAuthEmailLocale(localeInput);
  const copy = localeMessages(locale);
  const redirectTo = passwordResetRedirectTo(locale);

  const custom = await generateAndSendLink(service, {
    email,
    type: "recovery",
    redirectTo,
    locale,
    kind: "recovery"
  });
  if (custom.ok) {
    return { ok: true, message: copy.resetSent };
  }
  if (custom.rateLimit) {
    return { ok: false, error: "rate_limit", message: custom.message };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const recovery = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  if (!recovery.error) {
    return { ok: true, message: copy.resetSent };
  }
  if (isAuthRateLimitError(recovery.error.message, recovery.error.status)) {
    return { ok: false, error: "rate_limit", message: copy.rateLimit };
  }
  return { ok: false, error: "send_failed", message: custom.message };
}
