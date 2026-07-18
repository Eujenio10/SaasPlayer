import { env } from "@/lib/env";
import { sportApiAbsoluteUrl } from "@/lib/sportapi-endpoints";

export async function footApiFetch(endpoint: string): Promise<Response> {
  return fetch(sportApiAbsoluteUrl(endpoint), {
    headers: {
      "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
      "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
    },
    cache: "no-store"
  });
}
