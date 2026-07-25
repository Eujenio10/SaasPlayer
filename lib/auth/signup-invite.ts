import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
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
    if (error || !data?.users?.length) return null;

    const user = data.users.find((item) => item.email?.toLowerCase() === target);
    if (user) return user;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function sendInviteEmail(
  service: SupabaseClient,
  email: string,
  redirectTo: string
) {
  return service.auth.admin.inviteUserByEmail(email, { redirectTo });
}

async function sendRecoveryEmail(email: string, redirectTo: string) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client.auth.resetPasswordForEmail(email, { redirectTo });
}

export type SignupEmailResult =
  | { ok: true; alreadyRegistered: false; resent: boolean; message: string }
  | { ok: true; alreadyRegistered: true; message: string }
  | { ok: false; error: "rate_limit" | "invite_failed"; message: string };

/**
 * Primo invito o reinvio se la registrazione non è stata completata.
 * Per reinvii usa recovery (stesso flusso → /set-password) per evitare errori "user exists".
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
    const recovery = await sendRecoveryEmail(email, redirectTo);
    if (!recovery.error) {
      return {
        ok: true,
        alreadyRegistered: false,
        resent: true,
        message:
          "Ti abbiamo reinviato l'email per completare la registrazione. Apri il link e scegli la password, poi accedi all'app."
      };
    }

    if (isAuthRateLimitError(recovery.error.message, recovery.error.status)) {
      return {
        ok: false,
        error: "rate_limit",
        message:
          "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra circa 60 minuti."
      };
    }

    const deleted = await service.auth.admin.deleteUser(existing.id);
    if (deleted.error) {
      return {
        ok: false,
        error: "invite_failed",
        message: deleted.error.message
      };
    }

    const reinvite = await sendInviteEmail(service, email, redirectTo);
    if (reinvite.error) {
      if (isAuthRateLimitError(reinvite.error.message, reinvite.error.status)) {
        return {
          ok: false,
          error: "rate_limit",
          message:
            "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra circa 60 minuti."
        };
      }
      return {
        ok: false,
        error: "invite_failed",
        message: reinvite.error.message
      };
    }

    return {
      ok: true,
      alreadyRegistered: false,
      resent: true,
      message:
        "Ti abbiamo reinviato l'email di registrazione. Apri il link e scegli la password, poi accedi all'app."
    };
  }

  const invite = await sendInviteEmail(service, email, redirectTo);
  if (invite.error) {
    const retryUser = await findAuthUserByEmail(service, email);
    if (retryUser && isRegistrationIncomplete(retryUser)) {
      const recovery = await sendRecoveryEmail(email, redirectTo);
      if (!recovery.error) {
        return {
          ok: true,
          alreadyRegistered: false,
          resent: true,
          message:
            "Ti abbiamo reinviato l'email per completare la registrazione. Apri il link e scegli la password, poi accedi all'app."
        };
      }
      if (isAuthRateLimitError(recovery.error.message, recovery.error.status)) {
        return {
          ok: false,
          error: "rate_limit",
          message:
            "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra circa 60 minuti."
        };
      }
    }

    if (retryUser && isRegistrationComplete(retryUser)) {
      return {
        ok: true,
        alreadyRegistered: true,
        message:
          "Questa email è già registrata. Accedi con la password. Se l'hai dimenticata, usa Recupera password dal login."
      };
    }

    if (isAuthRateLimitError(invite.error.message, invite.error.status)) {
      return {
        ok: false,
        error: "rate_limit",
        message:
          "Troppe email inviate in poco tempo. Controlla posta in arrivo e spam, oppure riprova tra circa 60 minuti."
      };
    }

    return {
      ok: false,
      error: "invite_failed",
      message: invite.error.message
    };
  }

  return {
    ok: true,
    alreadyRegistered: false,
    resent: false,
    message:
      "Ti abbiamo inviato un'email. Apri il link per confermare e scegliere la password, poi torna sull'app e accedi."
  };
}
