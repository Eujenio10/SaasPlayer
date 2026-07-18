import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client service-role standalone (no import da next/headers).
 * Usato per snapshot kiosk/marcature: evita problemi di bundling nelle Route Handlers.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key?.trim()) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(url.trim(), key.trim(), {
    auth: { persistSession: false }
  });
}
