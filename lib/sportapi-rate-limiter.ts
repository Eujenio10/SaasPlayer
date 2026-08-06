/**
 * Limita il rate delle chiamate verso RapidAPI (FootAPI) e ritenta automaticamente
 * sui 429 con backoff. Senza questo, un batch di fetch quasi simultanee (es. durante
 * l'admin refresh o il calcolo insights di una partita con ~20 giocatori) supera il
 * limite per-secondo del piano RapidAPI e genera una cascata di errori 429 che fa
 * fallire interi batch di dati ("statistiche aggiornate per 0 di N partite").
 */

const MIN_INTERVAL_MS = Number(process.env.SPORTAPI_MIN_INTERVAL_MS ?? "180");
const MAX_RETRIES_429 = Number(process.env.SPORTAPI_MAX_RETRIES_429 ?? "4");
const BASE_BACKOFF_MS = Number(process.env.SPORTAPI_429_BACKOFF_MS ?? "700");

let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializza l'accesso al "turno" di invio richiesta, mantenendo un intervallo minimo fisso. */
async function waitForTurn(): Promise<void> {
  const myTurn = queueTail.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    const wait = MIN_INTERVAL_MS - elapsed;
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  queueTail = myTurn.catch(() => undefined);
  await myTurn;
}

function retryAfterMsFromHeader(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

/**
 * Esegue `performFetch` rispettando un ritmo minimo tra le richieste e ritentando
 * automaticamente in caso di 429, con backoff esponenziale (rispetta `Retry-After` se presente).
 */
export async function throttledSportApiRequest(
  performFetch: () => Promise<Response>
): Promise<Response> {
  let attempt = 0;
  let lastResponse: Response;

  for (;;) {
    await waitForTurn();
    lastResponse = await performFetch();

    if (lastResponse.status !== 429 || attempt >= MAX_RETRIES_429) {
      return lastResponse;
    }

    const headerDelay = retryAfterMsFromHeader(lastResponse);
    const backoff = headerDelay ?? BASE_BACKOFF_MS * Math.pow(2, attempt);
    attempt += 1;
    console.warn("[sportapi-rate-limiter] retry_429", { attempt, backoffMs: backoff });
    await sleep(backoff);
  }
}
