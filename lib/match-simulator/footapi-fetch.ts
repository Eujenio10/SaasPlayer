import { env } from "@/lib/env";
import { sportApiAbsoluteUrl } from "@/lib/sportapi-endpoints";
import { throttledSportApiRequest } from "@/lib/sportapi-rate-limiter";

export async function footApiFetch(endpoint: string): Promise<Response> {
  /** Throttling + retry sui 429: condiviso con sportApiFetch per rispettare lo stesso rate limit. */
  return throttledSportApiRequest(() =>
    fetch(sportApiAbsoluteUrl(endpoint), {
      headers: {
        "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
        "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
      },
      cache: "no-store"
    })
  );
}
