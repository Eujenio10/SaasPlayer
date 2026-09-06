import { canonicalCompetitionId } from "@/lib/difficult-markings/query";
import { collectMarkingsForCompetition } from "@/lib/difficult-markings/query";
import { loadBestDifficultMarkingsSnapshot } from "@/lib/difficult-markings/snapshot";
import { pruneMarkingsSnapshot } from "@/lib/difficult-markings/fixture-eligibility";
import { loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import { translateTeamName } from "@/lib/italian-sports-display";
import type { UpcomingMatchItem } from "@/services/sportapi";
import {
  combineFantaRating,
  computeConsistencyScore,
  computePerformanceScore,
  computeProductionScore,
  computeTrend,
  lastNRatings,
  mean,
  shortTrendDelta,
  shortTrendRatings
} from "@/lib/fanta/rating";
import { loadCompetitionPlayerRows, loadPlayerFantaRows, searchFantaPlayers } from "@/lib/fanta/appearances";
import {
  matchupScoreForPlayer,
  nextOpponentForTeam,
  pickPlayerMarking
} from "@/lib/fanta/matchup";
import { attachFantasyMatchups, evaluateFantasyMatchup, toFantasyMatchupCard } from "@/lib/fanta/fantasy-matchup-engine";
import { buildFantaMatchupBriefing, flattenMatchupBriefing } from "@/lib/fanta/matchup-briefing";
import { persistFantasyPlayerIndex, persistPlayerMatchPerformance } from "@/lib/fanta/persist";
import { resolveFantacalcioQuotation, fantaTeamsMatch } from "@/lib/fanta/quotazioni";
import { playerNameMatchesQuery } from "@/lib/player-identity";
import { scoutReasons } from "@/lib/fanta/reasons";
import { compareFantaDuel, fantaDuelRoleError } from "@/lib/fanta/duel";
import { fantaCompetitionId } from "@/lib/fanta/competition";
import type {
  FantaComputedPlayer,
  FantaDuelResult,
  FantaMatchupBriefing,
  FantaMatchupCard,
  FantaPlayerSearchHit,
  FantaRankingRow,
  FantaRoleGroup,
  FantaScoutPlayer,
  FantaTrendCategory,
  FantaTrendRow
} from "@/lib/fanta/types";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

const CACHE_TTL_MS = 180_000;
const RANKING_LIMIT = 40;
const TREND_LIMIT = 20;

interface CatalogCache {
  at: number;
  players: FantaComputedPlayer[];
  markings: DifficultMarkingMatchup[];
  rounds: string[];
  updatedAt: string | null;
  upcoming: UpcomingMatchItem[];
}

const catalogCache = new Map<string, CatalogCache>();

function cacheKey(organizationId: string, competitionId: string, locale: string): string {
  return `${organizationId}:${competitionId}:${locale}`;
}

function round2(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function lastTenRatings(appearances: FantaComputedPlayer["appearances"]): Array<number | null> {
  return appearances.slice(-10).map((row) => row.ratingApi);
}

function teamIdsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function teamNameFromMarkings(markings: DifficultMarkingMatchup[], teamId: string): string {
  const hit = markings.find(
    (item) => teamIdsEqual(item.attackerTeamId, teamId) || teamIdsEqual(item.defenderTeamId, teamId)
  );
  if (!hit) return "";
  const name = teamIdsEqual(hit.attackerTeamId, teamId) ? hit.attackerTeamName : hit.defenderTeamName;
  return translateTeamName(name);
}

function opponentFromMarking(item: DifficultMarkingMatchup, playerId: string): string {
  if (teamIdsEqual(item.attackerPlayerId, playerId)) return translateTeamName(item.defenderTeamName);
  return translateTeamName(item.attackerTeamName);
}

function nextOpponentFromMenu(
  upcoming: UpcomingMatchItem[],
  teamId: string,
  teamName: string,
  competitionId: string
): string | null {
  const serieA = upcoming.filter(
    (match) => canonicalCompetitionId(match.competitionSlug) === competitionId
  );
  const hit = serieA.find(
    (match) =>
      teamIdsEqual(String(match.homeTeam.id), teamId) ||
      teamIdsEqual(String(match.awayTeam.id), teamId) ||
      (teamName &&
        (fantaTeamsMatch(match.homeTeam.name, teamName) ||
          fantaTeamsMatch(match.awayTeam.name, teamName)))
  );
  if (!hit) return null;
  const isHome =
    teamIdsEqual(String(hit.homeTeam.id), teamId) ||
    Boolean(teamName && fantaTeamsMatch(hit.homeTeam.name, teamName));
  return translateTeamName(isHome ? hit.awayTeam.name : hit.homeTeam.name);
}

function fillNextOpponents(
  players: FantaComputedPlayer[],
  markings: DifficultMarkingMatchup[],
  upcoming: UpcomingMatchItem[],
  competitionId: string
): void {
  const byTeam = new Map<string, string>();
  for (const player of players) {
    const fromMenu = nextOpponentFromMenu(upcoming, player.teamId, player.teamName, competitionId);
    const fromMarking = player.nextOpponentName;
    const fromTeam = nextOpponentForTeam(markings, player.teamId, player.teamName);
    player.nextOpponentName = fromMenu ?? fromMarking ?? fromTeam ?? null;
    if (player.nextOpponentName && player.teamId) {
      byTeam.set(player.teamId, player.nextOpponentName);
    }
  }
  for (const player of players) {
    if (player.nextOpponentName || !player.teamId) continue;
    player.nextOpponentName = byTeam.get(player.teamId) ?? null;
  }
}

function computePlayer(
  raw: Awaited<ReturnType<typeof loadCompetitionPlayerRows>>[number],
  markings: DifficultMarkingMatchup[],
  locale: "it" | "en"
): FantaComputedPlayer {
  const marking = pickPlayerMarking(markings, raw.playerId);
  const matchupScore = marking ? matchupScoreForPlayer(marking, raw.playerId) : null;
  const fromMarkings = teamNameFromMarkings(markings, raw.teamId);
  const quote = resolveFantacalcioQuotation(raw.playerName, fromMarkings);
  const teamName = fromMarkings || quote?.team || "";
  const roleGroup = quote?.roleGroup ?? raw.roleGroup;
  const performance = computePerformanceScore(raw.appearances);
  const production = computeProductionScore(raw.appearances, roleGroup);
  const consistency = computeConsistencyScore(raw.appearances);
  const scores = combineFantaRating({
    performance,
    production,
    consistency,
    matchup: matchupScore
  });
  const avgRating5 = mean(lastNRatings(raw.appearances, 5));
  const avgRating10 = mean(lastNRatings(raw.appearances, 10));
  const lastRating = raw.appearances.at(-1)?.ratingApi ?? null;
  const ratingDelta = shortTrendDelta(raw.appearances);
  const trend = computeTrend(raw.appearances);
  const reasons = scoutReasons({
    appearances: raw.appearances,
    avgRating5,
    production,
    trend,
    tone: null,
    locale
  });
  return {
    playerId: raw.playerId,
    playerName: raw.playerName,
    teamId: raw.teamId,
    teamName,
    roleGroup,
    listRole: quote?.role ?? raw.listRole,
    mantra: quote?.mantra ?? raw.mantra,
    competitionId: raw.competitionId,
    seasonId: raw.seasonId,
    appearances: raw.appearances,
    scores,
    lastRating: round2(lastRating),
    avgRating5: round2(avgRating5),
    avgRating10: round2(avgRating10),
    ratingDelta,
    trend,
    nextOpponentName:
      marking
        ? opponentFromMarking(marking, raw.playerId)
        : nextOpponentForTeam(markings, raw.teamId, teamName),
    matchup: null,
    reasons
  };
}

async function loadMarkings(
  organizationId: string,
  competitionId: string
): Promise<{
  markings: DifficultMarkingMatchup[];
  rounds: string[];
  updatedAt: string | null;
  upcoming: UpcomingMatchItem[];
}> {
  const loaded = await loadBestDifficultMarkingsSnapshot(organizationId);
  const upcoming = await loadOrganizationUpcomingMenuMatches(loaded.organizationId);
  const kickoffByFixtureId = new Map<string, number>();
  for (const match of upcoming) {
    kickoffByFixtureId.set(String(match.eventId), match.startTimestamp);
  }
  const snapshot = loaded.snapshot ? pruneMarkingsSnapshot(loaded.snapshot, kickoffByFixtureId) : null;
  const markings = collectMarkingsForCompetition(snapshot, competitionId, kickoffByFixtureId);
  const rounds = [
    ...new Set(
      (snapshot?.rounds ?? [])
        .filter((round) => canonicalCompetitionId(round.competitionId) === competitionId)
        .map((round) => round.round)
        .filter(Boolean)
    )
  ];
  return {
    markings,
    rounds,
    updatedAt: snapshot?.updatedAt ?? loaded.snapshot?.updatedAt ?? null,
    upcoming
  };
}

function applyMatchupToPlayer(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  markings: DifficultMarkingMatchup[],
  locale: "it" | "en"
): void {
  const pool = catalog.some((row) => row.playerId === player.playerId) ? catalog : [...catalog, player];
  const evaluated = evaluateFantasyMatchup({ player, catalog: pool, markings, locale });
  if (!evaluated) {
    player.matchup = null;
    return;
  }
  player.scores = combineFantaRating({
    performance: player.scores.performance,
    production: player.scores.production,
    consistency: player.scores.consistency,
    matchup: evaluated.matchup_score
  });
  player.matchup = toFantasyMatchupCard({ player, catalog: pool, result: evaluated, locale });
  player.reasons = scoutReasons({
    appearances: player.appearances,
    avgRating5: player.avgRating5,
    production: player.scores.production,
    trend: player.trend,
    tone: player.matchup.tone,
    locale
  });
}

function fillTeamNamesFromTeammates(players: FantaComputedPlayer[]): void {
  const votes = new Map<string, Map<string, number>>();
  for (const player of players) {
    if (!player.teamId || !player.teamName) continue;
    const byName = votes.get(player.teamId) ?? new Map<string, number>();
    byName.set(player.teamName, (byName.get(player.teamName) ?? 0) + 1);
    votes.set(player.teamId, byName);
  }
  const resolved = new Map<string, string>();
  for (const [teamId, byName] of votes) {
    let best = "";
    let bestCount = 0;
    for (const [name, count] of byName) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    if (best) resolved.set(teamId, best);
  }
  for (const player of players) {
    if (!player.teamName) player.teamName = resolved.get(player.teamId) ?? "";
  }
}

export async function loadFantaCatalog(params: {
  organizationId: string;
  competitionId: string;
  locale?: "it" | "en";
}): Promise<CatalogCache> {
  const competitionId = fantaCompetitionId();
  const locale = params.locale ?? "it";
  const key = cacheKey(params.organizationId, competitionId, locale);
  const cached = catalogCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  const [rows, markingPack] = await Promise.all([
    loadCompetitionPlayerRows({ competitionId }),
    loadMarkings(params.organizationId, competitionId)
  ]);
  const players = rows
    .filter((row) => row.appearances.some((app) => app.minutes >= 10))
    .map((row) => computePlayer(row, markingPack.markings, locale));
  fillTeamNamesFromTeammates(players);
  fillNextOpponents(players, markingPack.markings, markingPack.upcoming, competitionId);
  attachFantasyMatchups(players, markingPack.markings, locale);
  for (const player of players) {
    player.reasons = scoutReasons({
      appearances: player.appearances,
      avgRating5: player.avgRating5,
      production: player.scores.production,
      trend: player.trend,
      tone: player.matchup?.tone ?? null,
      locale
    });
  }
  players.sort((a, b) => b.scores.pitchbrainFantaRating - a.scores.pitchbrainFantaRating);

  const entry: CatalogCache = {
    at: Date.now(),
    players,
    markings: markingPack.markings,
    rounds: markingPack.rounds,
    updatedAt: markingPack.updatedAt,
    upcoming: markingPack.upcoming
  };
  catalogCache.set(key, entry);
  void persistFantasyPlayerIndex(players);
  return entry;
}

function toScout(player: FantaComputedPlayer): FantaScoutPlayer {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    teamId: player.teamId,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    listRole: player.listRole,
    mantra: player.mantra,
    scores: player.scores,
    lastRating: player.lastRating,
    avgRating5: player.avgRating5,
    avgRating10: player.avgRating10,
    ratingDelta: player.ratingDelta,
    trend: player.trend,
    lastFive: player.appearances.slice(-5).reverse(),
    lastTenRatings: lastTenRatings(player.appearances),
    nextOpponentName: player.nextOpponentName,
    matchup: player.matchup,
    reasons: player.reasons
  };
}

export async function buildFantaScout(params: {
  organizationId: string;
  competitionId: string;
  playerId: string;
  locale?: "it" | "en";
}): Promise<FantaScoutPlayer | null> {
  const locale = params.locale ?? "it";
  const catalog = await loadFantaCatalog({
    organizationId: params.organizationId,
    competitionId: params.competitionId,
    locale
  });
  const fromCatalog = catalog.players.find((player) => player.playerId === params.playerId);
  if (fromCatalog) {
    void persistPlayerMatchPerformance(fromCatalog.playerId, fromCatalog.teamId, fromCatalog.appearances);
    return toScout(fromCatalog);
  }

  const raw = await loadPlayerFantaRows({
    playerId: params.playerId,
    competitionId: fantaCompetitionId()
  });
  if (!raw) return null;
  const computed = computePlayer(raw, catalog.markings, locale);
  fillNextOpponents([computed], catalog.markings, catalog.upcoming, fantaCompetitionId());
  applyMatchupToPlayer(computed, catalog.players, catalog.markings, locale);
  void persistPlayerMatchPerformance(computed.playerId, computed.teamId, computed.appearances);
  return toScout(computed);
}

export async function buildFantaRanking(params: {
  organizationId: string;
  competitionId: string;
  role?: FantaRoleGroup | "all";
  locale?: "it" | "en";
}): Promise<{ rows: FantaRankingRow[]; updatedAt: string | null; rounds: string[] }> {
  const catalog = await loadFantaCatalog(params);
  const role = params.role && params.role !== "all" ? params.role : null;
  const filtered = role ? catalog.players.filter((player) => player.roleGroup === role) : catalog.players;
  const rows = filtered.slice(0, RANKING_LIMIT).map((player, index) => ({
    rank: index + 1,
    playerId: player.playerId,
    playerName: player.playerName,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    listRole: player.listRole,
    mantra: player.mantra,
    rating: player.scores.pitchbrainFantaRating,
    form: player.trend,
    avgRating5: player.avgRating5
  }));
  return { rows, updatedAt: catalog.updatedAt, rounds: catalog.rounds };
}

export async function buildFantaTrends(params: {
  organizationId: string;
  competitionId: string;
  category: FantaTrendCategory;
  locale?: "it" | "en";
}): Promise<{ rows: FantaTrendRow[]; updatedAt: string | null }> {
  const catalog = await loadFantaCatalog(params);
  const withShortTrend = catalog.players.filter((player) => shortTrendRatings(player.appearances).length >= 3);
  const withRatings = catalog.players.filter((player) => lastNRatings(player.appearances, 5).length >= 3);
  let sorted: FantaComputedPlayer[] = [];
  if (params.category === "rising") {
    sorted = withShortTrend
      .filter((player) => player.trend === "up")
      .sort((a, b) => (b.ratingDelta ?? 0) - (a.ratingDelta ?? 0));
  } else if (params.category === "falling") {
    sorted = withShortTrend
      .filter((player) => player.trend === "down")
      .sort((a, b) => (a.ratingDelta ?? 0) - (b.ratingDelta ?? 0));
  } else if (params.category === "best5") {
    sorted = withRatings.sort((a, b) => (b.avgRating5 ?? 0) - (a.avgRating5 ?? 0));
  } else {
    sorted = withRatings.sort((a, b) => (b.avgRating10 ?? 0) - (a.avgRating10 ?? 0));
  }
  const shortWindow = params.category === "rising" || params.category === "falling";
  const rows = sorted.slice(0, TREND_LIMIT).map((player) => ({
    playerId: player.playerId,
    playerName: player.playerName,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    ratings: (shortWindow ? shortTrendRatings(player.appearances) : lastNRatings(player.appearances, 5)).map(
      (n) => round2(n) ?? n
    ),
    trend: player.trend,
    avgRecent: params.category === "best10" ? player.avgRating10 : shortWindow ? mean(shortTrendRatings(player.appearances)) : player.avgRating5,
    pitchbrainFantaRating: player.scores.pitchbrainFantaRating
  }));
  return { rows, updatedAt: catalog.updatedAt };
}

export async function buildFantaMatchups(params: {
  organizationId: string;
  competitionId: string;
  locale?: "it" | "en";
}): Promise<{
  briefing: FantaMatchupBriefing;
  results: FantaMatchupCard[];
  updatedAt: string | null;
  rounds: string[];
}> {
  const catalog = await loadFantaCatalog(params);
  const briefing = buildFantaMatchupBriefing(catalog.players, params.locale ?? "it");
  return {
    briefing,
    results: flattenMatchupBriefing(briefing),
    updatedAt: catalog.updatedAt,
    rounds: catalog.rounds
  };
}

export async function buildFantaMatchupDetail(params: {
  organizationId: string;
  competitionId: string;
  matchupId: string;
  locale?: "it" | "en";
}): Promise<FantaMatchupCard | null> {
  const catalog = await loadFantaCatalog(params);
  const briefing = buildFantaMatchupBriefing(catalog.players, params.locale ?? "it");
  const fromBriefing = flattenMatchupBriefing(briefing).find(
    (row) => row.matchupId === params.matchupId || row.playerId === params.matchupId
  );
  if (fromBriefing) return fromBriefing;
  const player = catalog.players.find((row) => row.playerId === params.matchupId);
  if (player?.matchup) return player.matchup;
  return catalog.players.find((row) => row.matchup?.matchupId === params.matchupId)?.matchup ?? null;
}

export async function searchFantaCatalog(params: {
  organizationId: string;
  competitionId: string;
  query: string;
  locale?: "it" | "en";
}): Promise<FantaPlayerSearchHit[]> {
  const q = params.query.trim();
  if (q.length < 2) return [];
  const catalog = await loadFantaCatalog(params);
  const teamHits = catalog.players.filter(
    (player) => player.teamName && fantaTeamsMatch(player.teamName, q)
  );
  const nameHits = catalog.players.filter(
    (player) => playerNameMatchesQuery(player.playerName, q) || playerNameMatchesQuery(player.teamName, q)
  );
  const merged = [...teamHits];
  for (const player of nameHits) {
    if (!merged.some((row) => row.playerId === player.playerId)) merged.push(player);
  }
  const fromCatalog = merged.slice(0, 20).map((player) => ({
    playerId: player.playerId,
    playerName: player.playerName,
    teamId: player.teamId,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    listRole: player.listRole,
    mantra: player.mantra
  }));
  if (fromCatalog.length) return fromCatalog;
  const hits = await searchFantaPlayers({
    query: params.query,
    competitionId: fantaCompetitionId()
  });
  return hits.map((hit) => {
    const fromMarkings = teamNameFromMarkings(catalog.markings, hit.teamId);
    const quote = resolveFantacalcioQuotation(hit.playerName, fromMarkings);
    return {
      ...hit,
      teamName: fromMarkings || quote?.team || "",
      roleGroup: quote?.roleGroup ?? hit.roleGroup,
      listRole: quote?.role ?? null,
      mantra: quote?.mantra ?? null
    };
  });
}

export type FantaDuelBuildResult =
  | { ok: true; duel: FantaDuelResult; updatedAt: string | null }
  | { ok: false; error: "role_mismatch" | "same_player" | "not_found"; message: string };

async function resolveCatalogPlayer(
  catalog: Awaited<ReturnType<typeof loadFantaCatalog>>,
  playerId: string,
  locale: "it" | "en"
): Promise<FantaComputedPlayer | null> {
  const fromCatalog = catalog.players.find((player) => player.playerId === playerId);
  if (fromCatalog) return fromCatalog;
  const raw = await loadPlayerFantaRows({
    playerId,
    competitionId: fantaCompetitionId()
  });
  if (!raw) return null;
  const computed = computePlayer(raw, catalog.markings, locale);
  fillNextOpponents([computed], catalog.markings, catalog.upcoming, fantaCompetitionId());
  applyMatchupToPlayer(computed, catalog.players, catalog.markings, locale);
  return computed;
}

export async function buildFantaDuel(params: {
  organizationId: string;
  competitionId: string;
  playerAId: string;
  playerBId: string;
  locale?: "it" | "en";
}): Promise<FantaDuelBuildResult> {
  const locale = params.locale ?? "it";
  if (params.playerAId === params.playerBId) {
    return {
      ok: false,
      error: "same_player",
      message:
        locale === "en"
          ? "Select two different players to compare."
          : "Seleziona due giocatori diversi per effettuare il confronto."
    };
  }

  const catalog = await loadFantaCatalog(params);
  const [playerA, playerB] = await Promise.all([
    resolveCatalogPlayer(catalog, params.playerAId, locale),
    resolveCatalogPlayer(catalog, params.playerBId, locale)
  ]);
  if (!playerA || !playerB) {
    return {
      ok: false,
      error: "not_found",
      message: locale === "en" ? "One of the selected players was not found." : "Uno dei giocatori selezionati non è stato trovato."
    };
  }
  if (playerA.roleGroup !== playerB.roleGroup) {
    return { ok: false, error: "role_mismatch", message: fantaDuelRoleError(locale) };
  }

  return {
    ok: true,
    duel: compareFantaDuel({
      playerA,
      playerB,
      catalog: catalog.players,
      locale
    }),
    updatedAt: catalog.updatedAt
  };
}
