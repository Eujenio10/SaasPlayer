function requireEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Variabile mancante: ${name}. Configura mobile/.env (vedi .env.example).`);
  }
  return value.trim();
}

export const env = {
  supabaseUrl: requireEnv(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL
  ),
  supabaseAnonKey: requireEnv(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ),
  /** URL del backend Next.js (es. http://192.168.1.10:3000 per test su dispositivo fisico). */
  apiUrl: requireEnv("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
  /** Alias legacy — usare `apiUrl`. */
  get apiBaseUrl() {
    return this.apiUrl;
  }
};
