import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const hash = parsed.hash.replace(/^#/, "");
    if (hash) {
      new URLSearchParams(hash).forEach((value, key) => {
        params[key] = value;
      });
    }
  } catch {
    const queryStart = url.indexOf("?");
    const hashStart = url.indexOf("#");
    const query =
      queryStart >= 0 ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined) : "";
    if (query) {
      new URLSearchParams(query).forEach((value, key) => {
        params[key] = value;
      });
    }
    if (hashStart >= 0) {
      new URLSearchParams(url.slice(hashStart + 1)).forEach((value, key) => {
        params[key] = value;
      });
    }
  }
  return params;
}

function pickParam(params: Record<string, string | undefined>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function otpTypesForParams(params: Record<string, string | undefined>): EmailOtpType[] {
  const hinted = pickParam(params, "type") as EmailOtpType | undefined;
  const next = pickParam(params, "next");
  const defaults: EmailOtpType[] =
    next === "reset-password" ? ["recovery", "signup", "email"] : ["signup", "email", "recovery"];

  if (hinted) {
    return [hinted, ...defaults.filter((item) => item !== hinted)];
  }
  return defaults;
}

/** Scambia code/token in una sessione persistita (query, hash o params Expo Router). */
export async function createSessionFromAuthParams(
  params: Record<string, string | undefined>
): Promise<boolean> {
  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error || "auth_callback_failed");
  }

  const code = pickParam(params, "code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken = pickParam(params, "access_token");
  const refreshToken = pickParam(params, "refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    return true;
  }

  const tokenHash = pickParam(params, "token_hash") ?? pickParam(params, "token");
  if (tokenHash) {
    let lastError: Error | null = null;
    for (const type of otpTypesForParams(params)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type
      });
      if (!error) return true;
      lastError = error;
    }
    if (lastError) throw lastError;
  }

  return false;
}

export async function createSessionFromAuthUrl(url: string): Promise<boolean> {
  return createSessionFromAuthParams(parseUrlParams(url));
}
