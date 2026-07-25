import * as Linking from "expo-linking";
import { env } from "@/lib/env";

/** Callback web (Safari) — affidabile per conferma e reset su iOS. */
export function webAuthCallbackUrl(nextPath: string): string {
  const base = env.apiUrl.replace(/\/$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

/** Deep link pitchbrain:// — solo se EXPO_PUBLIC_AUTH_MOBILE_EMAIL_LINKS=1 */
export function authCallbackUrl(next?: string): string {
  if (env.authCallbackUrlOverride) {
    const base = env.authCallbackUrlOverride.replace(/\/$/, "");
    if (!next) return base;
    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}next=${encodeURIComponent(next)}`;
  }

  const path = next
    ? `auth/callback?next=${encodeURIComponent(next)}`
    : "auth/callback";
  return Linking.createURL(path, { scheme: env.authCallbackScheme });
}

/** Reset password → web /set-password (default). */
export function passwordResetRedirectUrl(): string {
  if (env.authUseMobileEmailLinks) {
    return authCallbackUrl("reset-password");
  }
  return webAuthCallbackUrl("/set-password");
}

/** Conferma registrazione → web /account/welcome (default). */
export function signupEmailRedirectUrl(): string {
  if (env.authCallbackUrlOverride) {
    return env.authCallbackUrlOverride.replace(/\/$/, "");
  }
  if (env.authUseMobileEmailLinks) {
    return authCallbackUrl();
  }
  return webAuthCallbackUrl("/account/welcome");
}
