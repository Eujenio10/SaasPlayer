import { env } from "@/lib/env";

const PRODUCTION_ORIGIN = "https://saas-player.vercel.app";

function webOrigin(): string {
  const fromEnv = env.apiUrl.replace(/\/$/, "");
  return fromEnv || PRODUCTION_ORIGIN;
}

/**
 * Callback client-side: legge #access_token dal browser (Supabase implicit flow).
 * NON usare /auth/confirm come redirect email — il server non vede l'hash.
 */
export function webAuthCallbackUrl(nextPath: string): string {
  return `${webOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function passwordResetRedirectUrl(): string {
  return webAuthCallbackUrl("/set-password");
}

export function signupEmailRedirectUrl(): string {
  return webAuthCallbackUrl("/account/welcome");
}
