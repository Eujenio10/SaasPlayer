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

export async function getApiUser(request?: Request): Promise<User | null> {
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
