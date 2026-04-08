import { createSupabaseServiceClient } from "@/lib/supabase/server";

interface CacheRow {
  cache_key: string;
  payload: unknown;
  expires_at: string;
}

export async function getApiCache<T>(key: string): Promise<T | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("api_cached_payloads")
    .select("cache_key, payload, expires_at")
    .eq("cache_key", key)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const row = data as CacheRow;
  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return row.payload as T;
}

export async function setApiCache<T>(
  key: string,
  payload: T,
  ttlHours: number
): Promise<void> {
  const safeTtl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24;
  const expiresAt = new Date(Date.now() + safeTtl * 60 * 60 * 1000).toISOString();

  const supabase = createSupabaseServiceClient();
  await supabase.from("api_cached_payloads").upsert(
    {
      cache_key: key,
      payload,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: "cache_key" }
  );
}
