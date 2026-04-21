export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
    }
    return value;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return value;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!value) {
      throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
    }
    return value;
  },
  get STRIPE_SECRET_KEY() {
    return process.env.STRIPE_SECRET_KEY ?? "";
  },
  get STRIPE_WEBHOOK_SECRET() {
    return process.env.STRIPE_WEBHOOK_SECRET ?? "";
  },
  get NEXT_PUBLIC_APP_URL() {
    const value = process.env.NEXT_PUBLIC_APP_URL;
    if (!value) {
      throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    }
    return value;
  },
  get SPORTAPI_RAPIDAPI_KEY() {
    const value = process.env.SPORTAPI_RAPIDAPI_KEY;
    if (!value) {
      throw new Error("Missing required environment variable: SPORTAPI_RAPIDAPI_KEY");
    }
    return value;
  },
  get SPORTAPI_RAPIDAPI_HOST() {
    const value = process.env.SPORTAPI_RAPIDAPI_HOST;
    if (!value) {
      throw new Error("Missing required environment variable: SPORTAPI_RAPIDAPI_HOST");
    }
    return value;
  },
  /**
   * OddsPapi (RapidAPI) — opzionale: se assente, le linee player props non vengono caricate.
   * Host tipico RapidAPI: `odds-api.p.rapidapi.com`
   */
  get ODDSAPI_RAPIDAPI_KEY() {
    return process.env.ODDSAPI_RAPIDAPI_KEY ?? "";
  },
  get ODDSAPI_RAPIDAPI_HOST() {
    return process.env.ODDSAPI_RAPIDAPI_HOST ?? "odds-api.p.rapidapi.com";
  }
};
