import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function parseUrlParams(url: string): Record<string, string> {
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
    const query = queryStart >= 0 ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined) : "";
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

/** Scambia code/token dall'URL di callback Supabase in una sessione persistita. */
export async function createSessionFromAuthUrl(url: string): Promise<boolean> {
  const params = parseUrlParams(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error || "auth_callback_failed");
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token
    });
    if (error) throw error;
    return true;
  }

  if (params.token_hash) {
    const type = (params.type ?? "signup") as EmailOtpType;
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type
    });
    if (error) throw error;
    return true;
  }

  return false;
}
