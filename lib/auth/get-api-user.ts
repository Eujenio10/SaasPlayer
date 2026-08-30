import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function extractBearerToken(request?: Request): string | null {
  const header = request?.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Client Supabase per Route Handlers: cookie (web) oppure Bearer JWT (app mobile Expo).
 */
export function createApiSupabaseClient(request?: Request): SupabaseClient {
  const token = extractBearerToken(request);
  if (token) {
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return createSupabaseServerClient();
}

function withAuthLookupTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("auth_lookup_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function lookupApiUser(request?: Request): Promise<User | null> {
  const token = extractBearerToken(request);
  if (token) {
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const {
      data: { user },
      error
    } = await client.auth.getUser(token);
    if (!error && user) return user;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getApiUser(request?: Request, timeoutMs = 3_500): Promise<User | null> {
  try {
    return await withAuthLookupTimeout(lookupApiUser(request), timeoutMs);
  } catch {
    return null;
  }
}
