import * as Linking from "expo-linking";

/** Deep link callback: pitchbrain://auth/callback */
export function authCallbackUrl(next?: string): string {
  const path = next
    ? `auth/callback?next=${encodeURIComponent(next)}`
    : "auth/callback";
  return Linking.createURL(path);
}

/** Redirect per recupero password → schermata reset in-app. */
export function passwordResetRedirectUrl(): string {
  return authCallbackUrl("reset-password");
}
