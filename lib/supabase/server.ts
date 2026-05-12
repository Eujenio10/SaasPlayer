import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Client per Route Handlers / Server Actions: scrive sulla cookie jar di Next.
 * Per login/logout con redirect, preferire `createSupabaseResponseClient` così i
 * cookie di sessione finiscono sulla stessa `NextResponse` (evita login “infinito” fino al refresh).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components Next.js blocks cookie writes.
          // In Route Handlers/Server Actions this call is allowed.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore write attempts when execution context is read-only.
          }
        }
      }
    }
  );
}

export function createSupabaseResponseClient(response: NextResponse, request: NextRequest) {
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
}

export function createSupabaseServiceClient() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );
}
