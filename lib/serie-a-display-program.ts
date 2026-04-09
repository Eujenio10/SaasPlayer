import { cache } from "react";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import { isHybridFullPlayerAnalyticsCompetitionSlug } from "@/lib/hybrid-player-analytics-competition";
import type {
  CompetitionScope,
  DisplayProgramPayload,
  DisplayProgramSlide,
  TacticalMetrics
} from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

function displayDayTimeZone(): string {
  const tz = process.env.TACTICAL_DISPLAY_DAY_TIMEZONE?.trim();
  return tz && tz.length > 0 ? tz : "Europe/Rome";
}

/** Data di calendario YYYY-MM-DD nel fuso del display (es. Italia per Serie A). */
function calendarDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

/** Calcio d’inizio nel giorno di calendario corrente (nel fuso del display). */
function isKickoffOnDisplayDay(
  match: UpcomingMatchItem,
  timeZone: string,
  now: Date = new Date()
): boolean {
  if (!match.startTimestamp || match.startTimestamp <= 0) return false;
  const today = calendarDateInTimeZone(now, timeZone);
  const kickoff = new Date(match.startTimestamp * 1000);
  return calendarDateInTimeZone(kickoff, timeZone) === today;
}

/** Chiave cache per giorno di calendario (cambio data = nuovo bucket, niente match “ieri” in cache). */
function displayProgramCacheKey(): string {
  const tz = displayDayTimeZone();
  const day = calendarDateInTimeZone(new Date(), tz);
  return `tactical_display_program:v10:serie_a_day:${day}`;
}

function normalizeCompetitionSlug(raw: string): string {
  const s = raw?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  return s;
}

function isSerieACompetitionSlug(slug: string): boolean {
  return normalizeCompetitionSlug(slug) === "serie-a";
}

function formatKickoffIt(ts: number, timeZone: string): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("it-IT", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function competitionLabelFromSlug(slug: string): string {
  const key = normalizeCompetitionSlug(slug);
  const labels: Record<string, string> = {
    "serie-a": "Serie A",
    "premier-league": "Premier League",
    laliga: "LaLiga",
    bundesliga: "Bundesliga",
    "ligue-1": "Ligue 1",
    "uefa-champions-league": "Champions League",
    "uefa-europa-league": "Europa League",
    "champions-league": "Champions League",
    "europa-league": "Europa League"
  };
  return labels[key] ?? slug;
}

function displayInsightsScopeFromMatch(match: UpcomingMatchItem): CompetitionScope {
  const slug = match.competitionSlug?.toLowerCase() ?? "";
  if (slug.includes("conference")) return "DOMESTIC";
  if (slug.includes("champions") || slug.includes("europa")) return "EUROPE";
  return "DOMESTIC";
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

type FrictionPair = { left: TacticalMetrics; right: TacticalMetrics; pairPriority: number };

/**
 * Stessa logica del kiosk per coppie di scontro incrociate casa/trasferta.
 */
function extractFrictionPairs(
  matchMetrics: TacticalMetrics[],
  homeTeamId: number,
  awayTeamId: number
): FrictionPair[] {
  const byId = new Map<number, TacticalMetrics>();
  const byName = new Map<string, TacticalMetrics[]>();
  for (const item of matchMetrics) {
    if (typeof item.playerId === "number" && item.playerId > 0) {
      byId.set(item.playerId, item);
    }
    const key = item.playerName.toUpperCase();
    const bucket = byName.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      byName.set(key, [item]);
    }
  }
  const map = new Map<string, FrictionPair>();

  for (const item of matchMetrics) {
    if (!item.sparkDuel) continue;
    const duelBId = item.sparkDuel.playerBId;
    const candidateById =
      typeof duelBId === "number" && duelBId > 0 ? byId.get(duelBId) ?? null : null;
    const candidatesByName = byName.get(item.sparkDuel.playerB.toUpperCase()) ?? [];
    const candidate =
      candidateById && candidateById.teamId !== item.teamId
        ? candidateById
        : candidatesByName.find((row) => row.teamId !== item.teamId) ?? null;
    if (!candidate) continue;
    if (candidate.teamId === item.teamId) continue;

    const teams = new Set([item.teamId, candidate.teamId]);
    if (!teams.has(homeTeamId) || !teams.has(awayTeamId)) continue;

    const directScore =
      item.foulsCommittedSeasonAvg +
      candidate.foulsSufferedSeasonAvg +
      item.foulsCommittedLastTwoAvg * 0.5 +
      candidate.foulsSufferedLastTwoAvg * 0.5;
    const reverseScore =
      candidate.foulsCommittedSeasonAvg +
      item.foulsSufferedSeasonAvg +
      candidate.foulsCommittedLastTwoAvg * 0.5 +
      item.foulsSufferedLastTwoAvg * 0.5;

    const left = directScore >= reverseScore ? item : candidate;
    const right = directScore >= reverseScore ? candidate : item;

    const pairKey =
      typeof left.playerId === "number" && typeof right.playerId === "number"
        ? `id:${Math.min(left.playerId, right.playerId)}|${Math.max(left.playerId, right.playerId)}`
        : [left.playerName, right.playerName].sort().join("|");
    const pairPriority =
      left.sparkIndex +
      right.sparkIndex +
      (left.foulsCommittedSeasonAvg + right.foulsSufferedSeasonAvg) * 5;

    const current = map.get(pairKey);
    if (!current || pairPriority > current.pairPriority) {
      map.set(pairKey, { left, right, pairPriority });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.pairPriority - a.pairPriority);
}

function topShootersForMatch(
  matchMetrics: TacticalMetrics[],
  homeTeamId: number,
  awayTeamId: number,
  limit: number
): TacticalMetrics[] {
  const allowed = new Set([homeTeamId, awayTeamId]);
  return matchMetrics
    .filter((m) => allowed.has(m.teamId))
    .filter((m) => m.roleIcon !== "🧤")
    .filter((m) => (m.shotsLastTwoSampleCount ?? 0) > 0 && m.shotsLastTwoAvg > 0)
    .sort((a, b) => b.shotsLastTwoAvg - a.shotsLastTwoAvg)
    .slice(0, limit);
}

async function buildSerieADisplayProgramBody(): Promise<DisplayProgramPayload> {
  const tz = displayDayTimeZone();
  const candidateCap = parsePositiveInt(process.env.TACTICAL_DISPLAY_SERIE_A_CANDIDATES, 10);
  const topMatchCap = parsePositiveInt(process.env.TACTICAL_DISPLAY_TOP_SERIE_A_MATCHES, 6);
  const topShooterCap = parsePositiveInt(process.env.TACTICAL_DISPLAY_TOP_SHOOTERS, 14);
  const maxFrictionSlidesPerMatch = parsePositiveInt(process.env.TACTICAL_DISPLAY_FRICTION_SLIDES_PER_MATCH, 5);
  const shootersPerSlide = parsePositiveInt(process.env.TACTICAL_DISPLAY_SHOOTERS_PER_SLIDE, 7);

  let allMatches: UpcomingMatchItem[] = [];
  try {
    allMatches = await getOrRefreshTacticalMatchesMenuFull();
  } catch {
    return {
      slides: [],
      updatedAt: new Date().toISOString(),
      sourceStatus: "empty",
      programContext: undefined
    };
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const serieAUpcoming = allMatches
      .filter((m) => isSerieACompetitionSlug(m.competitionSlug))
      .filter((m) => m.startTimestamp > 0 && m.startTimestamp > nowSec)
      .sort((a, b) => a.startTimestamp - b.startTimestamp);

    const serieAToday = serieAUpcoming.filter((m) => isKickoffOnDisplayDay(m, tz));

    /** Serie A / Champions / Europa, kickoff futuro, ordinati per data (il primo è il match più vicino tra le tre competizioni). */
    const priorityLeaguesUpcoming = allMatches
      .filter((m) => isHybridFullPlayerAnalyticsCompetitionSlug(m.competitionSlug))
      .filter((m) => m.startTimestamp > 0 && m.startTimestamp > nowSec)
      .sort((a, b) => a.startTimestamp - b.startTimestamp);

    /** Oggi: solo Serie A del giorno. Senza Serie A oggi: prossimi match tra SA, UCL e UEL (per kick-off più vicino). */
    const programContext =
      serieAToday.length > 0 ? ("serie_a_today" as const) : ("serie_a_next" as const);
    const candidatePool =
      programContext === "serie_a_today"
        ? serieAToday.slice(0, candidateCap)
        : priorityLeaguesUpcoming.slice(0, candidateCap);

    const insightsCacheTtlHours = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");

    type Scored = {
      match: UpcomingMatchItem;
      metrics: TacticalMetrics[];
      pairs: FrictionPair[];
      interest: number;
    };

    const scored: Scored[] = [];

    for (const match of candidatePool) {
      try {
        const compSlug = normalizeCompetitionSlugForInsights(match.competitionSlug) || "serie-a";
        const bundle = await getOrComputeMatchInsightsPayload(
          {
            eventId: match.eventId,
            homeTeamId: match.homeTeam.id,
            awayTeamId: match.awayTeam.id,
            homeTeamName: match.homeTeam.name,
            awayTeamName: match.awayTeam.name,
            competitionSlug: compSlug,
            scope: displayInsightsScopeFromMatch(match),
            includeDiagnostics: false,
            singleMatchTest: false,
            forceBlueprintRefresh: false,
            /** Stessa chiave del kiosk hybrid Serie A (`playerAnalytics=serie_a_players`). */
            playerAnalyticsMode: "serie_a_players"
          },
          insightsCacheTtlHours
        );

        const matchRows = bundle.metrics.filter(
          (m) => m.teamId === match.homeTeam.id || m.teamId === match.awayTeam.id
        );
        if (!matchRows.length) continue;

        const pairs = extractFrictionPairs(matchRows, match.homeTeam.id, match.awayTeam.id);
        const interest = pairs[0]?.pairPriority ?? 0;

        scored.push({ match, metrics: matchRows, pairs, interest });
      } catch {
        continue;
      }
    }

    if (programContext === "serie_a_today") {
      scored.sort((a, b) => {
        if (b.interest !== a.interest) return b.interest - a.interest;
        return a.match.startTimestamp - b.match.startTimestamp;
      });
    } else {
      scored.sort((a, b) => {
        if (a.match.startTimestamp !== b.match.startTimestamp) {
          return a.match.startTimestamp - b.match.startTimestamp;
        }
        return b.interest - a.interest;
      });
    }

    const selected = scored.slice(0, topMatchCap);
    const slides: DisplayProgramSlide[] = [];

    for (const row of selected) {
      const m = row.match;
      const kickoffLabel = formatKickoffIt(m.startTimestamp, tz);
      const matchTitle = `${m.homeTeam.name} — ${m.awayTeam.name}`;
      const competitionLabel = competitionLabelFromSlug(m.competitionSlug);

      /**
       * Evita duplicati: non mostrare due volte lo stesso scontro e,
       * per qualità display, non riutilizzare lo stesso giocatore in più “zone di scontro”
       * all'interno della stessa partita.
       */
      const usedPairKeys = new Set<string>();
      const usedPlayers = new Set<string>();
      let frictionSlidesAdded = 0;
      for (const pair of row.pairs) {
        if (frictionSlidesAdded >= maxFrictionSlidesPerMatch) break;
        const hm = pair.left.sparkFrictionHeatmap;
        if (!hm) continue;

        const a = pair.left.playerName.trim().toUpperCase();
        const b = pair.right.playerName.trim().toUpperCase();
        if (!a || !b) continue;

        const pairKey = [a, b].sort().join("|");
        if (usedPairKeys.has(pairKey)) continue;
        if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

        usedPairKeys.add(pairKey);
        usedPlayers.add(a);
        usedPlayers.add(b);
        frictionSlidesAdded += 1;

        slides.push({
          kind: "friction",
          eventId: m.eventId,
          kickoffLabel,
          matchTitle,
          competitionLabel,
          narrative: pair.left.sparkNarrative,
          frictionExplanation: pair.left.sparkFrictionExplanation ?? null,
          heatmap: hm
        });
      }

      const shooters = topShootersForMatch(row.metrics, m.homeTeam.id, m.awayTeam.id, topShooterCap);
      if (shooters.length > 0) {
        const totalChunks = Math.ceil(shooters.length / shootersPerSlide);
        for (let start = 0; start < shooters.length; start += shootersPerSlide) {
          const slice = shooters.slice(start, start + shootersPerSlide);
          const chunkIndex = Math.floor(start / shootersPerSlide) + 1;
          slides.push({
            kind: "shooters",
            eventId: m.eventId,
            kickoffLabel,
            matchTitle,
            competitionLabel,
            chunkHint:
              totalChunks > 1
                ? `Tiratori: parte ${chunkIndex} di ${totalChunks} (pos. ${start + 1}–${start + slice.length})`
                : undefined,
            players: slice.map((p, i) => ({
              rank: start + i + 1,
              playerName: p.playerName,
              team: p.team,
              clubColor: p.clubColor,
              jerseyNumber: p.jerseyNumber,
              shotsLastTwoAvg: p.shotsLastTwoAvg,
              shotsLastTwoSampleCount: p.shotsLastTwoSampleCount ?? 0,
              roleIcon: p.roleIcon
            }))
          });
        }
      }
    }

    return {
      slides,
      updatedAt: new Date().toISOString(),
      sourceStatus: slides.length > 0 ? "ok" : "empty",
      programContext
    };
  } catch {
    return {
      slides: [],
      updatedAt: new Date().toISOString(),
      sourceStatus: "error",
      programContext: undefined
    };
  }
}

export async function getSerieADisplayProgram(forceRefresh: boolean): Promise<DisplayProgramPayload> {
  const cacheHours = parsePositiveInt(process.env.TACTICAL_DISPLAY_PROGRAM_CACHE_HOURS, 2);

  const cacheKey = displayProgramCacheKey();

  if (!forceRefresh) {
    const cached = await getApiCache<DisplayProgramPayload>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const built = await buildSerieADisplayProgramBody();
  /**
   * Non congelare un programma vuoto per ore: può capitare durante cambio piano/quota o cache menu vuota.
   * Se non ci sono slide, lasciamo che la prossima richiesta ritenti (o usi `refresh=1`).
   */
  if (built.slides.length > 0) {
    await setApiCache(cacheKey, built, cacheHours);
  }
  return built;
}

/** Deduplica nella stessa richiesta server (page + layout). */
export const getCachedSerieADisplayProgram = cache(async () => getSerieADisplayProgram(false));
