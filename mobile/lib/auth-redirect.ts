import { env } from "@/lib/env";

const PRODUCTION_ORIGIN = "https://saas-player.vercel.app";

function webOrigin(): string {
  const fromEnv = env.apiUrl.replace(/\/$/, "");
  return fromEnv || PRODUCTION_ORIGIN;
}

/**
 * Route server Supabase: gestisce token_hash e code lato server (affidabile su iOS/Safari).
 * Aggiungi in Supabase Redirect URLs:
 * https://saas-player.vercel.app/auth/confirm
 */
export function webAuthConfirmUrl(nextPath: string): string {
  return `${webOrigin()}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}

/** Fallback client per token nel fragment (#access_token). */
export function webAuthCallbackUrl(nextPath: string): string {
  return `${webOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function passwordResetRedirectUrl(): string {
  return webAuthConfirmUrl("/set-password");
}

export function signupEmailRedirectUrl(): string {
  return webAuthConfirmUrl("/account/welcome");
}
