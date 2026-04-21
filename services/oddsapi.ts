import { env } from "@/lib/env";
import { getApiCache, setApiCache } from "@/lib/api-cache";

export const ODDS_MARKET_PLAYER_FOULS_COMMITTED_OU = 102706;
export const ODDS_MARKET_PLAYER_TO_BE_CARDED_OU = 102736;

type OddsApiFixtureOddsResponse = {
  fixtures?: Array<{
    fixtureId?: number;
    sportId?: number;
    leagues?: unknown;
    participants?: unknown;
    bookmakers?: Array<{
      bookmakerId?: number;
      bookmakerName?: string;
      markets?: Array<{
        marketId?: number;
        marketName?: string;
        playerName?: string;
        playerId?: number;
        handicap?: number | string | null;
        outcomes?: Array<{
          outcomeName?: string; // Over/Under
          odds?: number | string | null;
        }>;
      }>;
    }>;
  }>;
};

export type PlayerPropLine = {
  playerName: string;
  playerId?: number;
  marketId: number;
  line: number;
  overOdds?: number;
  underOdds?: number;
  bookmaker?: string;
};

type OddsApiFixture = NonNullable<OddsApiFixtureOddsResponse["fixtures"]>[number];
type OddsApiBookmaker = NonNullable<OddsApiFixture["bookmakers"]>[number];

function normalizePlayerName(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toUpperCase();
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickBestBookmaker(bookmakers: OddsApiFixture["bookmakers"]): OddsApiBookmaker | null {
  const list = Array.isArray(bookmakers) ? bookmakers : [];
  if (!list.length) return null;
  // Heuristica: se troviamo un book "sharp" noto, preferiscilo.
  const prefer = ["Pinnacle", "Pin", "Bet365", "Betfair"];
  const byName = (n: string) => prefer.some((p) => n.toLowerCase().includes(p.toLowerCase()));
  return list.find((b) => byName(b.bookmakerName ?? "")) ?? list[0] ?? null;
}

function extractOuLineFromMarket(market: { handicap?: unknown; outcomes?: unknown }): {
  line: number | null;
  overOdds?: number;
  underOdds?: number;
} {
  const line = numeric(market.handicap);
  if (typeof line !== "number" || !Number.isFinite(line)) return { line: null };

  const outcomes = Array.isArray(market.outcomes) ? (market.outcomes as Array<Record<string, unknown>>) : [];
  const over = outcomes.find((o) => String(o.outcomeName ?? "").toLowerCase() === "over");
  const under = outcomes.find((o) => String(o.outcomeName ?? "").toLowerCase() === "under");
  return {
    line: line,
    overOdds: numeric(over?.odds),
    underOdds: numeric(under?.odds)
  };
}

export async function fetchFixturePlayerPropLines(params: {
  fixtureId: number;
  marketIds: number[];
  cacheTtlHours?: number;
}): Promise<PlayerPropLine[]> {
  if (!env.ODDSAPI_RAPIDAPI_KEY) return [];
  const fixtureId = params.fixtureId;
  const marketIds = (params.marketIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (!fixtureId || marketIds.length === 0) return [];

  const cacheKey = `odds_props:v1:${fixtureId}:m:${marketIds.slice().sort((a, b) => a - b).join(",")}`;
  const cached = await getApiCache<PlayerPropLine[]>(cacheKey);
  if (cached) return cached;

  const host = env.ODDSAPI_RAPIDAPI_HOST;
  const url = `https://${host}/v4/fixtures/odds?fixtureId=${encodeURIComponent(
    String(fixtureId)
  )}&marketIds=${encodeURIComponent(marketIds.join(","))}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": env.ODDSAPI_RAPIDAPI_KEY,
      "x-rapidapi-host": host
    },
    // Evitiamo caching Next qui: gestiamo via Supabase cache.
    cache: "no-store"
  });
  if (!res.ok) return [];

  const payload = (await res.json()) as OddsApiFixtureOddsResponse;
  const fixture = (payload.fixtures ?? []).find((f) => (f.fixtureId ?? 0) === fixtureId) ?? payload.fixtures?.[0];
  const bookmaker = pickBestBookmaker(fixture?.bookmakers);
  const markets = Array.isArray(bookmaker?.markets) ? bookmaker?.markets ?? [] : [];

  const out: PlayerPropLine[] = [];
  for (const m of markets) {
    const marketId = m.marketId ?? 0;
    if (!marketIds.includes(marketId)) continue;
    const playerName = (m.playerName ?? "").trim();
    if (!playerName) continue;

    const { line, overOdds, underOdds } = extractOuLineFromMarket(m);
    if (line === null) continue;

    out.push({
      playerName,
      playerId: typeof m.playerId === "number" ? m.playerId : undefined,
      marketId,
      line,
      overOdds,
      underOdds,
      bookmaker: bookmaker?.bookmakerName ?? undefined
    });
  }

  // Dedupe: una riga per player+market, preferendo quella con odds entrambe presenti.
  const byKey = new Map<string, PlayerPropLine>();
  for (const row of out) {
    const key = `${row.marketId}|${normalizePlayerName(row.playerName)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const prevScore = (prev.overOdds ? 1 : 0) + (prev.underOdds ? 1 : 0);
    const rowScore = (row.overOdds ? 1 : 0) + (row.underOdds ? 1 : 0);
    if (rowScore > prevScore) byKey.set(key, row);
  }

  const final = Array.from(byKey.values());
  await setApiCache(cacheKey, final, params.cacheTtlHours ?? 0.5);
  return final;
}

