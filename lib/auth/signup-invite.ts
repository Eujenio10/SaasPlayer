import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function signupRedirectTo(): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${appUrl}/auth/callback?next=${encodeURIComponent("/set-password")}`;
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

export type SignupEmailResult =
  | { ok: true; alreadyRegistered: false; resent: boolean; message: string }
  | { ok: true; alreadyRegistered: true; message: string }
  | { ok: false; error: "rate_limit" | "invite_failed"; message: string };

/**
 * Registrazione/reinvio via Supabase Auth + SMTP custom (Aruba).
 * L'email viene inviata dal mailer Supabase, non da Resend.
 */
export async function sendSignupOrResendEmail(
  service: SupabaseClient,
  email: string
): Promise<SignupEmailResult> {
  const redirectTo = signupRedirectTo();
  const existing = await findAuthUserByEmail(service, email);

  if (existing && isRegistrationComplete(existing)) {
    return {
      ok: true,
      alreadyRegistered: true,
      message:
        "Questa email è già registrata. Accedi con la password. Se l'hai dimenticata, usa Recupera password dal login."
    };
  }

  if (existing && isRegistrationIncomplete(existing)) {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const recovery = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (!recovery.error) {
      return {
        ok: true,
        alreadyRegistered: false,
        resent: true,
        message:
          "Ti abbiamo reinviato l'email per completare la registrazione. Apri il link e scegli la password."
      };
    }
    if (isAuthRateLimitError(recovery.error.message, recovery.error.status)) {
      return {
        ok: false,
        error: "rate_limit",
        message:
          "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra qualche minuto."
      };
    }
    return {
      ok: false,
      error: "invite_failed",
      message: "Reinvio non riuscito. Riprova tra qualche minuto."
    };
  }

  const invite = await service.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invite.error) {
    if (isAuthRateLimitError(invite.error.message, invite.error.status)) {
      return {
        ok: false,
        error: "rate_limit",
        message:
          "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra qualche minuto."
      };
    }

    const retryUser = await findAuthUserByEmail(service, email);
    if (retryUser && isRegistrationComplete(retryUser)) {
      return {
        ok: true,
        alreadyRegistered: true,
        message:
          "Questa email è già registrata. Accedi con la password. Se l'hai dimenticata, usa Recupera password dal login."
      };
    }

    return {
      ok: false,
      error: "invite_failed",
      message: "Registrazione non riuscita. Riprova tra qualche minuto."
    };
  }

  return {
    ok: true,
    alreadyRegistered: false,
    resent: false,
    message:
      "Ti abbiamo inviato un'email. Apri il link per confermare e scegliere la password, poi accedi."
  };
}
