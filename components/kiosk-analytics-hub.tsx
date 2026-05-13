"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMatchupDetailModel, MatchupDetailPage } from "@/components/matchup-detail";
import { FoulCommittedRiskPanel } from "@/components/foul-committed-risk/foul-committed-risk-panel";
import { FoulSufferedRiskPanel } from "@/components/foul-suffered-risk/foul-suffered-risk-panel";
import { analyzeFoulRisk } from "@/lib/foul-risk-analysis";
import { filterMatchesKickoffInFuture, dedupeMatchesByEventId } from "@/lib/tactical-matches-filters";
import type { FoulRiskAggressorBrief, FoulRiskEntry } from "@/lib/foul-risk-analysis";
import type { UserAccessSummary } from "@/lib/auth/user-access";
import type { CompetitionScope, TacticalMetrics } from "@/lib/types";
import {
  bumpAdminInsightsSnap,
  clearAllKioskInsightsLocal,
  KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT,
  readKioskInsightsLocal,
  readKioskMatchesCache,
  writeKioskInsightsLocal,
  writeKioskMatchesCache
} from "@/lib/kiosk-persisted-insights";
import type { UpcomingMatchItem } from "@/services/sportapi";
import {
  committedFoulSignalForRisk,
  foulsSufferedPerMatchForDisplay,
  sufferedFoulSignalForRisk
} from "@/lib/tactical-fouls-signals";

type KioskView = "PLAYER_FRICTION" | "FOUL_RISK_SUFFERED" | "FOUL_RISK_COMMITTED";

interface RoundFoulLeaderEntry {
  entry: FoulRiskEntry;
  match: UpcomingMatchItem;
}

interface BookingAlarmEntry {
  player: TacticalMetrics;
  match: UpcomingMatchItem;
  marker: FoulRiskAggressorBrief;
  starRating: number;
  score: number;
}

export type PlayerAnalyticsPolicy = "full" | "serie_a_players";

interface KioskAnalyticsHubProps {
  initialMetrics: TacticalMetrics[];
  organizationId: string;
  fixtureId: string;
  userAccess: UserAccessSummary;
  /** `full`: sempre stats giocatori + heatmap. `serie_a_players`: pieno per Serie A, Champions, Europa e Conference (con Serie A); nessuna analisi giocatori per Serie B e altre leghe del menu. */
  playerAnalyticsPolicy?: PlayerAnalyticsPolicy;
  kioskTitle?: string;
  kioskDescription?: string;
  testingMatch?: {
    home: string;
    away: string;
    competition: string;
  };
  presetMatch?: UpcomingMatchItem;
}

async function fetchOrgKioskInsightsFromApi(eventId: number): Promise<{
  metrics: TacticalMetrics[];
  playerDetailLevel: "full" | "team_only";
  insightsSnap: number;
} | null> {
  try {
    const res = await fetch(
      `/api/tactical/org-kiosk-match-insights?eventId=${encodeURIComponent(String(eventId))}`,
      { cache: "no-store", credentials: "include" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      metrics?: TacticalMetrics[];
      playerDetailLevel?: string;
      insightsSnap?: number;
    };
    const metrics = Array.isArray(json.metrics) ? json.metrics : [];
    if (metrics.length === 0) return null;
    const playerDetailLevel = json.playerDetailLevel === "team_only" ? "team_only" : "full";
    const insightsSnap = typeof json.insightsSnap === "number" ? json.insightsSnap : 0;
    return { metrics, playerDetailLevel, insightsSnap };
  } catch {
    return null;
  }
}

async function persistOrgKioskInsightsToApi(params: {
  eventId: number;
  insightsSnap: number;
  playerDetailLevel: "full" | "team_only";
  metrics: TacticalMetrics[];
}): Promise<boolean> {
  try {
    const res = await fetch("/api/tactical/org-kiosk-match-insights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        eventId: params.eventId,
        insightsSnap: params.insightsSnap,
        playerDetailLevel: params.playerDetailLevel,
        metrics: params.metrics
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function consumeMemberMatchWeekSlotIfNeeded(params: {
  eventId: number;
  isMember: boolean;
}): Promise<{ ok: true } | { ok: false; reason: "limit" | "network" }> {
  if (!params.isMember) return { ok: true };
  try {
    const res = await fetch("/api/tactical/member-match-week-consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ eventId: params.eventId })
    });
    if (res.status === 403) return { ok: false, reason: "limit" };
    if (!res.ok) return { ok: false, reason: "network" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

const SINGLE_MATCH_MODE = process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_MODE === "1";
const SINGLE_MATCH_HOME =
  process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_HOME?.trim() || "Paris Saint-Germain";
const SINGLE_MATCH_AWAY = process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_AWAY?.trim() || "Toulouse";
const SINGLE_MATCH_COMPETITION =
  process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_COMPETITION?.trim() || "ligue-1";

function scopeFromCompetitionSlug(slug: string): CompetitionScope {
  if (slug.includes("champions") || slug.includes("europa") || slug.includes("conference")) return "EUROPE";
  if (
    slug.includes("fa-cup") ||
    slug.includes("coppa-italia") ||
    slug.includes("copa-del-rey") ||
    slug.includes("dfb-pokal") ||
    slug.includes("coupe-de-france")
  ) {
    return "CUP";
  }
  return "DOMESTIC";
}

/** Allineato a `normalizeCompetitionSlug` in sportapi (client-safe). */
function normalizeKioskCompetitionSlug(slug: string): string {
  const s = slug?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  return s;
}

function competitionLabel(slug: string): string {
  const key = normalizeKioskCompetitionSlug(slug);
  const labels: Record<string, string> = {
    "serie-a": "Serie A",
    "premier-league": "Premier League",
    laliga: "LaLiga",
    bundesliga: "Bundesliga",
    "ligue-1": "Ligue 1",
    "uefa-champions-league": "Champions League",
    "uefa-europa-league": "Europa League",
    "uefa-europa-conference-league": "Conference League",
    "champions-league": "Champions League",
    "europa-league": "Europa League",
    "europa-conference-league": "Conference League",
    "conference-league": "Conference League",
    "serie-b": "Serie B",
    "italy-serie-b": "Serie B"
  };
  return labels[key] ?? slug;
}

function isTopFiveLeagueSlug(slug: string): boolean {
  return new Set(["serie-a", "premier-league", "laliga", "bundesliga", "ligue-1"]).has(
    normalizeKioskCompetitionSlug(slug)
  );
}

function formatKickoff(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizePlayerName(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toUpperCase();
}

/**
 * Canonical key for de-duping "visually same" players.
 * We intentionally do NOT rely on provider playerId because sometimes it duplicates the same player with different IDs.
 */
function playerStableKey(item: TacticalMetrics): string {
  return `t:${item.teamId}|n:${normalizePlayerName(item.playerName)}`;
}

function formatStat(value: unknown): string {
  return numeric(value).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function starString(value: number): string {
  const full = Math.max(1, Math.min(5, Math.round(value)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function simpleLevelFromScore(score: number): string {
  if (score >= 82) return "Molto alta";
  if (score >= 66) return "Alta";
  if (score >= 50) return "Media";
  return "Bassa";
}

function dribbleSignal(m: TacticalMetrics): number {
  return numeric(m.dribblesSeasonAvg);
}

function bookingAlarmTargetFouls(player: TacticalMetrics): number {
  return foulsSufferedPerMatchForDisplay(player);
}

function bookingAlarmScore(target: TacticalMetrics, marker: FoulRiskAggressorBrief): number {
  return (
    marker.foulsCommittedSeasonAvg * 2.9 +
    bookingAlarmTargetFouls(target) * 2.25 +
    dribbleSignal(target) * 2.05 +
    marker.markingScore * 0.045
  );
}

function bookingAlarmStars(score: number, target: TacticalMetrics, marker: FoulRiskAggressorBrief): number {
  const strongTarget = bookingAlarmTargetFouls(target) >= 1.8 && dribbleSignal(target) >= 1.15;
  const strongMarker = marker.foulsCommittedSeasonAvg >= 1.15 && marker.markingScore >= 70;
  if (score >= 12 && strongTarget && strongMarker) return 5;
  if (score >= 9.5 && bookingAlarmTargetFouls(target) >= 1.55 && dribbleSignal(target) >= 0.95) return 4;
  if (score >= 7.4) return 3;
  return 2;
}

type AlarmRoleBand = "gk" | "def" | "mid" | "att";
type AlarmLane = -1 | 0 | 1;

function alarmRoleBand(m: TacticalMetrics): AlarmRoleBand {
  if (m.roleIcon === "🧤") return "gk";
  if (m.roleIcon === "🛡️") return "def";
  if (m.roleIcon === "🎯") return "att";
  return "mid";
}

function alarmPositionLane(positionCode?: string): AlarmLane {
  const s = (positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s || s === "G" || s.startsWith("GK")) return 0;
  if (/^(DL|LWB|LB|ML|AML|LW|LM|WL)(\/|$)/.test(s)) return -1;
  if (/^(DR|RWB|RB|MR|AMR|RW|RM|WR)(\/|$)/.test(s)) return 1;
  const last = s[s.length - 1];
  const first = s[0];
  if (last === "L" && /^[DAMFW]/.test(first)) return -1;
  if (last === "R" && /^[DAMFW]/.test(first)) return 1;
  return 0;
}

function findBookingAlarmMarker(
  player: TacticalMetrics,
  metrics: TacticalMetrics[]
): FoulRiskAggressorBrief | null {
  const playerLane = alarmPositionLane(player.positionCode);
  const candidates = metrics
    .filter((opponent) => opponent.teamId !== player.teamId)
    .filter((opponent) => {
      const role = alarmRoleBand(opponent);
      return role === "def" || role === "mid";
    })
    .map((opponent) => {
      const role = alarmRoleBand(opponent);
      const markerLane = alarmPositionLane(opponent.positionCode);
      const mirroredWide = playerLane !== 0 && markerLane !== 0 && playerLane === -markerLane;
      const sameProviderWide = playerLane !== 0 && markerLane !== 0 && playerLane === markerLane;
      const bothCentral = playerLane === 0 && markerLane === 0;
      const oneWideOneUnknown = (playerLane !== 0 && markerLane === 0) || (playerLane === 0 && markerLane !== 0);
      const roleScore = role === "def" ? 28 : 14;
      const laneScore = mirroredWide ? 64 : sameProviderWide ? 44 : bothCentral ? 34 : oneWideOneUnknown ? 18 : 0;
      const aggressionScore = Math.min(28, committedFoulSignalForRisk(opponent) * 12);
      return {
        opponent,
        score: laneScore + roleScore + aggressionScore
      };
    })
    .filter((candidate) => candidate.score >= 48)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;
  return {
    playerName: best.opponent.playerName,
    team: best.opponent.team,
    positionCode: best.opponent.positionCode,
    markingScore: Math.round(Math.min(100, best.score)),
    riskContribution: Math.round(best.score) / 100,
    foulsCommittedSeasonAvg: best.opponent.foulsCommittedSeasonAvg,
    foulsSufferedSeasonAvg: best.opponent.foulsSufferedSeasonAvg
  };
}

function isDirectionalFoulMatchup(likelyOffender: TacticalMetrics, likelyVictim: TacticalMetrics): boolean {
  const committed = committedFoulSignalForRisk(likelyOffender);
  const suffered = sufferedFoulSignalForRisk(likelyVictim);
  return (
    (committed >= 1.1 && suffered >= 1.25) ||
    (committed >= 1.35 && suffered >= 1.05)
  );
}

async function fetchMatchMetricsForBookingAlarm(params: {
  match: UpcomingMatchItem;
  playerAnalyticsParam: string;
  parentSignal: AbortSignal;
}): Promise<TacticalMetrics[]> {
  const { match, playerAnalyticsParam, parentSignal } = params;
  const ac = new AbortController();
  const timeoutId = window.setTimeout(() => ac.abort(), BOOKING_ALARM_REQUEST_TIMEOUT_MS);
  const abortFromParent = () => ac.abort();
  parentSignal.addEventListener("abort", abortFromParent, { once: true });

  try {
    const scope = scopeFromCompetitionSlug(match.competitionSlug);
    const res = await fetch(
      `/api/tactical/match-insights?eventId=${match.eventId}&homeTeamId=${match.homeTeam.id}&awayTeamId=${match.awayTeam.id}&homeTeamName=${encodeURIComponent(
        match.homeTeam.name
      )}&awayTeamName=${encodeURIComponent(
        match.awayTeam.name
      )}&competitionSlug=${encodeURIComponent(match.competitionSlug)}&scope=${scope}${playerAnalyticsParam}`,
      { cache: "no-store", signal: ac.signal }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { metrics?: TacticalMetrics[] };
    return Array.isArray(json.metrics) ? json.metrics : [];
  } catch {
    return [];
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal.removeEventListener("abort", abortFromParent);
  }
}

const BOOKING_ALARM_MAX_MATCHES = 12;
const BOOKING_ALARM_BATCH_SIZE = 4;
const BOOKING_ALARM_REQUEST_TIMEOUT_MS = 12_000;
const BOOKING_ALARM_MIN_TARGET_FOULS = 1.4;
const BOOKING_ALARM_MIN_TARGET_DRIBBLES = 0.45;
const softPanelClass =
  "rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.045] to-cyan-300/[0.035] p-4 shadow-[0_16px_45px_rgba(8,13,28,0.26)] ring-1 ring-white/5 backdrop-blur";
const subtleCardClass =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-fuchsia-300/[0.035] p-4";
const infoBoxClass =
  "rounded-2xl border border-cyan-200/20 bg-gradient-to-r from-cyan-300/10 to-fuchsia-300/10 px-4 py-3 text-sm text-slate-200";
const primaryButtonClass =
  "rounded-full border border-cyan-200/50 bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/25 transition hover:scale-[1.02] hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

export function KioskAnalyticsHub(props: KioskAnalyticsHubProps) {
  const {
    initialMetrics,
    fixtureId,
    playerAnalyticsPolicy = "full",
    kioskTitle = "Kiosk Tactical Menu",
    kioskDescription,
    testingMatch,
    presetMatch,
    userAccess
  } = props;
  const [view, setView] = useState<KioskView>("PLAYER_FRICTION");
  const [metrics, setMetrics] = useState<TacticalMetrics[]>(initialMetrics);
  const [playerDetailLevel, setPlayerDetailLevel] = useState<"full" | "team_only">("full");

  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  /** Aggiornato ogni minuto: ricalcola il filtro “solo future” senza nuove richieste API. */
  const [matchListTimeTick, setMatchListTimeTick] = useState(0);
  // Nessun campionato selezionato al primo caricamento: l’utente deve scegliere.
  const [selectedCompetition, setSelectedCompetition] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [loadingMatchInsights, setLoadingMatchInsights] = useState(false);
  const [matchInsightsError, setMatchInsightsError] = useState<string | null>(null);
  /** Durante prefetch di massa tutte le viste leggono dalla cache locale appena disponibile senza rifetch paralleli. */
  const [adminBulkRefreshing, setAdminBulkRefreshing] = useState(false);
  /** Progress overlay durante “Aggiorna dati admin” (solo top 5 campionati). */
  const [adminBulkProgress, setAdminBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const mountedRef = useRef(true);
  /** Indice scontro aperto quando ci sono più duello; `null` = elenco. */
  const [frictionDetailIndex, setFrictionDetailIndex] = useState<number | null>(null);

  /** Top giornata calcolata sui matchup dei match visibili del campionato selezionato. */
  const [roundMatchupLeaders, setRoundMatchupLeaders] = useState<
    { suffered: RoundFoulLeaderEntry[]; committed: RoundFoulLeaderEntry[] } | undefined
  >(undefined);
  const [roundMatchupLoading, setRoundMatchupLoading] = useState(false);
  const [roundMatchupUsedFallback, setRoundMatchupUsedFallback] = useState(false);
  const [bookingAlarmLeaders, setBookingAlarmLeaders] = useState<BookingAlarmEntry[] | undefined>(undefined);
  const [bookingAlarmLoading, setBookingAlarmLoading] = useState(false);
  const [accessSummary, setAccessSummary] = useState<UserAccessSummary>(userAccess);
  const canRefreshData = accessSummary.canRefreshData;

  async function reloadAccessSummary(): Promise<void> {
    try {
      const response = await fetch("/api/user/access", {
        cache: "no-store",
        credentials: "include"
      });
      if (!response.ok) return;
      const data = (await response.json()) as UserAccessSummary | { error?: string };
      if (data && typeof data === "object" && "error" in data && data.error) return;
      if (!("matchUsage" in data)) return;
      setAccessSummary(data as UserAccessSummary);
    } catch {
      // Il counter non deve bloccare la consultazione dei dati gia caricati.
    }
  }

  useEffect(() => {
    if (userAccess.matchUsage.limit != null) {
      void reloadAccessSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allineamento contatore da server al mount
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function prefetchAllMenuInsights(
    targets: UpcomingMatchItem[],
    snap: number,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const deduped = dedupeMatchesByEventId(targets);
    const total = deduped.length;
    if (total === 0) {
      onProgress?.(0, 0);
      return;
    }

    const playerAnalyticsParam =
      playerAnalyticsPolicy === "serie_a_players" ? "&playerAnalytics=serie_a_players" : "";
    const concurrency = 3;

    onProgress?.(0, total);

    async function fetchOne(match: UpcomingMatchItem): Promise<void> {
      const scope = scopeFromCompetitionSlug(match.competitionSlug);
      const query = `/api/tactical/match-insights?eventId=${match.eventId}&homeTeamId=${match.homeTeam.id}&awayTeamId=${match.awayTeam.id}&homeTeamName=${encodeURIComponent(
        match.homeTeam.name
      )}&awayTeamName=${encodeURIComponent(
        match.awayTeam.name
      )}&competitionSlug=${encodeURIComponent(match.competitionSlug)}&scope=${scope}&forceRefresh=1${playerAnalyticsParam}`;
      try {
        const response = await fetch(query, { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as {
          metrics?: TacticalMetrics[];
          playerDetailLevel?: "full" | "team_only";
        };
        writeKioskInsightsLocal(match.eventId, {
          metrics: Array.isArray(json.metrics) ? json.metrics : [],
          playerDetailLevel: json.playerDetailLevel === "team_only" ? "team_only" : "full",
          insightsSnap: snap
        });
        const metricsPersist = Array.isArray(json.metrics) ? json.metrics : [];
        const pdlPersist =
          json.playerDetailLevel === "team_only" ? ("team_only" as const) : ("full" as const);
        if (metricsPersist.length > 0) {
          void persistOrgKioskInsightsToApi({
            eventId: match.eventId,
            insightsSnap: snap,
            playerDetailLevel: pdlPersist,
            metrics: metricsPersist
          });
        }
      } catch {
        // Prefetch massivo best-effort: errori isolati non bloccano gli altri eventId.
      }
    }

    for (let i = 0; i < deduped.length; i += concurrency) {
      const slice = deduped.slice(i, i + concurrency);
      await Promise.all(slice.map((m) => fetchOne(m)));
      const completed = Math.min(i + slice.length, deduped.length);
      onProgress?.(completed, total);
    }
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      setMatchListTimeTick((t) => t + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingMatches = useMemo(
    () => {
      // Recompute time-based "future match" filtering every minute.
      void matchListTimeTick;
      return filterMatchesKickoffInFuture(matches);
    },
    [matches, matchListTimeTick]
  );
  const upcomingMatchesRef = useRef<UpcomingMatchItem[]>(upcomingMatches);
  useEffect(() => {
    upcomingMatchesRef.current = upcomingMatches;
  }, [upcomingMatches]);

  const visibleMatches = useMemo(() => {
    if (!selectedCompetition) return [];
    const want = normalizeKioskCompetitionSlug(selectedCompetition);
    return upcomingMatches.filter(
      (item) => normalizeKioskCompetitionSlug(item.competitionSlug) === want
    );
  }, [upcomingMatches, selectedCompetition]);

  const leagueFilterSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const m of upcomingMatches) {
      const n = normalizeKioskCompetitionSlug(m.competitionSlug);
      if (n) set.add(n);
    }
    return Array.from(set).sort();
  }, [upcomingMatches]);
  const bookingAlarmMatchKey = useMemo(
    () => upcomingMatches.map((m) => `${m.eventId}:${m.startTimestamp}`).join("|"),
    [upcomingMatches]
  );

  useEffect(() => {
    setSelectedMatchId((prev) => {
      if (visibleMatches.length === 0) return prev;
      if (visibleMatches.some((m) => m.eventId === prev)) return prev;
      return visibleMatches[0].eventId;
    });
  }, [visibleMatches]);

  const selectedMatch = useMemo(
    () => visibleMatches.find((item) => item.eventId === selectedMatchId) ?? visibleMatches[0] ?? null,
    [visibleMatches, selectedMatchId]
  );

  const selectedMatchMetrics = useMemo(() => {
    if (!selectedMatch) return [];
    const allowed = new Set([selectedMatch.homeTeam.id, selectedMatch.awayTeam.id]);
    return metrics.filter((item) => allowed.has(item.teamId));
  }, [metrics, selectedMatch]);

  const selectedMetricsByRosterKey = useMemo(() => {
    const map = new Map<string, TacticalMetrics>();
    for (const m of selectedMatchMetrics) {
      const key = `${m.teamId}|${normalizePlayerName(m.playerName)}`;
      const prev = map.get(key);
      // Preferisci la riga che ha linee odds (quando presenti) o playerId.
      if (!prev) {
        map.set(key, m);
        continue;
      }
      const prevHasOdds = Boolean(prev.oddsFoulsCommittedLine || prev.oddsCardsLine);
      const nextHasOdds = Boolean(m.oddsFoulsCommittedLine || m.oddsCardsLine);
      if (nextHasOdds && !prevHasOdds) {
        map.set(key, m);
        continue;
      }
      const prevHasId = typeof prev.playerId === "number" && prev.playerId > 0;
      const nextHasId = typeof m.playerId === "number" && m.playerId > 0;
      if (nextHasId && !prevHasId) map.set(key, m);
    }
    return map;
  }, [selectedMatchMetrics]);

  const matchFrictionPairs = useMemo(() => {
    if (!selectedMatch) return [];
    const byId = new Map<number, TacticalMetrics>();
    const byName = new Map<string, TacticalMetrics[]>();
    for (const item of selectedMatchMetrics) {
      if (typeof item.playerId === "number" && item.playerId > 0) {
        byId.set(item.playerId, item);
      }
      const key = item.playerName.toUpperCase();
      const bucket = byName.get(key);
      if (bucket) bucket.push(item);
      else byName.set(key, [item]);
    }
    const map = new Map<string, { left: TacticalMetrics; right: TacticalMetrics; pairPriority: number }>();

    for (const item of selectedMatchMetrics) {
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
      if (!teams.has(selectedMatch.homeTeam.id) || !teams.has(selectedMatch.awayTeam.id)) continue;

      const directInteresting = isDirectionalFoulMatchup(item, candidate);
      const reverseInteresting = isDirectionalFoulMatchup(candidate, item);
      if (!directInteresting && !reverseInteresting) continue;

      const directScore =
        committedFoulSignalForRisk(item) * 1.15 +
        sufferedFoulSignalForRisk(candidate) +
        item.sparkIndex * 0.08 +
        candidate.sparkIndex * 0.04;
      const reverseScore =
        committedFoulSignalForRisk(candidate) * 1.15 +
        sufferedFoulSignalForRisk(item) +
        candidate.sparkIndex * 0.08 +
        item.sparkIndex * 0.04;

      const useDirect =
        directInteresting && reverseInteresting
          ? directScore >= reverseScore
          : directInteresting;
      const left = useDirect ? item : candidate;
      const right = useDirect ? candidate : item;

      const key =
        typeof left.playerId === "number" && typeof right.playerId === "number"
          ? `id:${Math.min(left.playerId, right.playerId)}|${Math.max(left.playerId, right.playerId)}`
          : [left.playerName, right.playerName].sort().join("|");
      const pairPriority =
        left.sparkIndex +
        right.sparkIndex +
        (committedFoulSignalForRisk(left) + sufferedFoulSignalForRisk(right)) * 8 +
        (left.h2hHadCard ? 4 : 0) +
        (right.h2hHadCard ? 2 : 0);

      const current = map.get(key);
      if (!current || pairPriority > current.pairPriority) {
        map.set(key, { left, right, pairPriority });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.pairPriority - a.pairPriority);
    const usedPairs = new Set<string>();
    const usedPlayers = new Set<string>();
    const maxInterestingFrictionPairs = 4;
    const out: Array<{ left: TacticalMetrics; right: TacticalMetrics; pairPriority: number }> = [];
    for (const pair of sorted) {
      if (out.length >= maxInterestingFrictionPairs) break;
      const aId = pair.left.playerId;
      const bId = pair.right.playerId;
      const pairKey =
        typeof aId === "number" && typeof bId === "number"
          ? `id:${Math.min(aId, bId)}|${Math.max(aId, bId)}`
          : [pair.left.playerName.trim().toUpperCase(), pair.right.playerName.trim().toUpperCase()]
              .sort()
              .join("|");
      if (usedPairs.has(pairKey)) continue;
      const aKey =
        typeof aId === "number" ? `id:${aId}` : `n:${pair.left.playerName.trim().toUpperCase()}`;
      const bKey =
        typeof bId === "number" ? `id:${bId}` : `n:${pair.right.playerName.trim().toUpperCase()}`;
      if (usedPlayers.has(aKey) || usedPlayers.has(bKey)) continue;
      usedPairs.add(pairKey);
      usedPlayers.add(aKey);
      usedPlayers.add(bKey);
      out.push(pair);
    }
    return out;
  }, [selectedMatch, selectedMatchMetrics]);

  useEffect(() => {
    setFrictionDetailIndex(null);
  }, [selectedMatch?.eventId]);

  const playerAnalyticsView: KioskView | null =
    view === "PLAYER_FRICTION" || view === "FOUL_RISK_SUFFERED" || view === "FOUL_RISK_COMMITTED"
      ? view
      : null;

  const foulRiskSufferedEntries = useMemo(() => {
    if (!selectedMatch) return [];
    return analyzeFoulRisk({
      metrics: selectedMatchMetrics,
      homeTeamId: selectedMatch.homeTeam.id,
      awayTeamId: selectedMatch.awayTeam.id,
      kind: "suffered"
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [selectedMatch, selectedMatchMetrics]);

  const foulRiskCommittedEntries = useMemo(() => {
    if (!selectedMatch) return [];
    return analyzeFoulRisk({
      metrics: selectedMatchMetrics,
      homeTeamId: selectedMatch.homeTeam.id,
      awayTeamId: selectedMatch.awayTeam.id,
      kind: "committed"
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [selectedMatch, selectedMatchMetrics]);

  const hasMatchFrameHeatmaps = useMemo(
    () =>
      selectedMatchMetrics.some(
        (m) => m.roleIcon !== "🧤" && (m.heatmapPointsMatchFrame?.length ?? 0) >= 3
      ),
    [selectedMatchMetrics]
  );

  const showRoundFormSpecial =
    (fixtureId === "kiosk-hybrid" || fixtureId === "kiosk") &&
    Boolean(selectedMatch) &&
    !accessSummary.isMember;
  const showBookingAlarm = false;

  useEffect(() => {
    if (!showRoundFormSpecial || !selectedMatch) {
      setRoundMatchupLeaders(undefined);
      setRoundMatchupLoading(false);
      setRoundMatchupUsedFallback(false);
      return;
    }
    if (adminBulkRefreshing) {
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setRoundMatchupLeaders(undefined);
    setRoundMatchupUsedFallback(false);
    setRoundMatchupLoading(true);

    async function loadRoundForm() {
      const suffered: RoundFoulLeaderEntry[] = [];
      const committed: RoundFoulLeaderEntry[] = [];
      const matchesToAnalyze = visibleMatches.slice(0, 10);

      try {
        for (const match of matchesToAnalyze) {
          if (cancelled || ac.signal.aborted) break;
          let list: TacticalMetrics[] | null =
            readKioskInsightsLocal(match.eventId)?.metrics ?? null;
          if (!Array.isArray(list) || list.length === 0) {
            const orgRow = await fetchOrgKioskInsightsFromApi(match.eventId);
            list = orgRow?.metrics?.length ? orgRow.metrics : null;
          }
          if (!list?.length) continue;

          const sufferedRows = analyzeFoulRisk({
            metrics: list,
            homeTeamId: match.homeTeam.id,
            awayTeamId: match.awayTeam.id,
            kind: "suffered"
          });
          const committedRows = analyzeFoulRisk({
            metrics: list,
            homeTeamId: match.homeTeam.id,
            awayTeamId: match.awayTeam.id,
            kind: "committed"
          });
          for (const entry of sufferedRows) suffered.push({ entry, match });
          for (const entry of committedRows) committed.push({ entry, match });
        }

        if (suffered.length === 0 && committed.length === 0 && selectedMatchMetrics.length > 0) {
          setRoundMatchupUsedFallback(true);
          for (const entry of analyzeFoulRisk({
            metrics: selectedMatchMetrics,
            homeTeamId: selectedMatch.homeTeam.id,
            awayTeamId: selectedMatch.awayTeam.id,
            kind: "suffered"
          })) {
            suffered.push({ entry, match: selectedMatch });
          }
          for (const entry of analyzeFoulRisk({
            metrics: selectedMatchMetrics,
            homeTeamId: selectedMatch.homeTeam.id,
            awayTeamId: selectedMatch.awayTeam.id,
            kind: "committed"
          })) {
            committed.push({ entry, match: selectedMatch });
          }
        }

        if (!cancelled) {
          setRoundMatchupLeaders({
            suffered: suffered.sort((a, b) => b.entry.riskScore - a.entry.riskScore).slice(0, 5),
            committed: committed.sort((a, b) => b.entry.riskScore - a.entry.riskScore).slice(0, 5)
          });
        }
      } catch {
        if (!cancelled) {
          setRoundMatchupLeaders({ suffered: [], committed: [] });
          setRoundMatchupUsedFallback(true);
        }
      } finally {
        if (!cancelled) setRoundMatchupLoading(false);
      }
    }

    void loadRoundForm();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    showRoundFormSpecial,
    selectedMatch,
    visibleMatches,
    selectedMatchMetrics,
    adminBulkRefreshing
  ]);

  useEffect(() => {
    if (!showBookingAlarm) {
      setBookingAlarmLeaders(undefined);
      setBookingAlarmLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    setBookingAlarmLeaders(undefined);
    setBookingAlarmLoading(true);

    async function loadBookingAlarm() {
      const bestByPlayer = new Map<string, BookingAlarmEntry>();
      const matchesToAnalyze = upcomingMatchesRef.current
        .filter((match) => isTopFiveLeagueSlug(match.competitionSlug))
        .slice(0, BOOKING_ALARM_MAX_MATCHES);
      const playerAnalyticsParam =
        playerAnalyticsPolicy === "serie_a_players" ? "&playerAnalytics=serie_a_players" : "";

      try {
        for (let i = 0; i < matchesToAnalyze.length && !ac.signal.aborted; i += BOOKING_ALARM_BATCH_SIZE) {
          const batch = matchesToAnalyze.slice(i, i + BOOKING_ALARM_BATCH_SIZE);
          const loaded = await Promise.all(
            batch.map(async (match) => ({
              match,
              metrics: await fetchMatchMetricsForBookingAlarm({
                match,
                playerAnalyticsParam,
                parentSignal: ac.signal
              })
            }))
          );

          for (const { match, metrics: list } of loaded) {
            if (!list.length) continue;

            const byPlayer = new Map<string, TacticalMetrics>();
            for (const player of list) {
              byPlayer.set(playerStableKey(player), player);
            }

            for (const player of byPlayer.values()) {
              if (player.roleIcon === "🧤") continue;
              const marker = findBookingAlarmMarker(player, list);
              if (!marker) continue;

              const foulsSuffered = bookingAlarmTargetFouls(player);
              const dribbles = dribbleSignal(player);
              if (foulsSuffered < BOOKING_ALARM_MIN_TARGET_FOULS) continue;
              if (dribbles < BOOKING_ALARM_MIN_TARGET_DRIBBLES) continue;

              const score = bookingAlarmScore(player, marker);
              const starRating = bookingAlarmStars(score, player, marker);
              if (starRating < 3) continue;
              const key = `marker:${marker.team}|${normalizePlayerName(marker.playerName)}`;
              const candidate: BookingAlarmEntry = { player, match, marker, starRating, score };
              const prev = bestByPlayer.get(key);
              if (!prev || candidate.score > prev.score) {
                bestByPlayer.set(key, candidate);
              }
            }
          }
        }

        if (!cancelled) {
          setBookingAlarmLeaders(
            Array.from(bestByPlayer.values())
              .sort((a, b) => b.score - a.score)
              .slice(0, 10)
          );
        }
      } catch {
        if (!cancelled && !ac.signal.aborted) {
          setBookingAlarmLeaders([]);
        }
      } finally {
        if (!cancelled) setBookingAlarmLoading(false);
      }
    }

    void loadBookingAlarm();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [showBookingAlarm, bookingAlarmMatchKey, playerAnalyticsPolicy]);

  useEffect(() => {
    async function loadMatches() {
      if (presetMatch) {
        const presetUpcoming = filterMatchesKickoffInFuture([presetMatch]);
        setMatches(presetUpcoming);
        // Non auto-selezionare match: prima l’utente deve scegliere il campionato.
        setSelectedMatchId(0);
        setMatchesError(null);
        return;
      }
      {
        const cached = readKioskMatchesCache(fixtureId);
        if (cached.length > 0) {
          setMatches(cached);
          setSelectedMatchId(0);
          setMatchesError(null);
        }
      }
      const singleMatchFilter = testingMatch ?? (SINGLE_MATCH_MODE
        ? {
            home: SINGLE_MATCH_HOME,
            away: SINGLE_MATCH_AWAY,
            competition: SINGLE_MATCH_COMPETITION
          }
        : null);
      const matchesUrl = singleMatchFilter
        ? `/api/tactical/matches?home=${encodeURIComponent(singleMatchFilter.home)}&away=${encodeURIComponent(
            singleMatchFilter.away
          )}&competition=${encodeURIComponent(singleMatchFilter.competition)}`
        : "/api/tactical/matches";
      const response = await fetch(matchesUrl, { cache: "no-store" });
      if (!response.ok) {
        setMatchesError("Impossibile caricare il menu partite.");
        return;
      }
      let json = (await response.json()) as {
        matches?: UpcomingMatchItem[];
        persistedSnapshotMissing?: boolean;
      };
      let list = json.matches ?? [];
      if (singleMatchFilter && list.length === 0) {
        const fallback = await fetch("/api/tactical/matches", { cache: "no-store" });
        if (fallback.ok) {
          json = (await fallback.json()) as {
            matches?: UpcomingMatchItem[];
            persistedSnapshotMissing?: boolean;
          };
          list = json.matches ?? [];
        }
      }
      const normalized = dedupeMatchesByEventId(
        list.map((m) => ({
          ...m,
          competitionSlug: normalizeKioskCompetitionSlug(m.competitionSlug)
        }))
      );
      setMatches(normalized);
      writeKioskMatchesCache(fixtureId, normalized);
      // Non auto-selezionare match: prima l’utente deve scegliere il campionato.
      setSelectedMatchId(0);
      if (
        normalized.length === 0 &&
        !presetMatch &&
        !testingMatch
      ) {
        setMatchesError(
          json.persistedSnapshotMissing
            ? "Menù partite non ancora salvato dall’organizzazione. Un amministratore deve aprire il Tactical Hub una volta (caricamento menu completo) così anche i profili Pro usano solo i dati in database, senza consumare il piano API esterno."
            : "Nessuna partita futura nel menù condiviso. Chiedi a un amministratore di aggiornare il Tactical Hub quando serve un refresh del calendario."
        );
      } else {
        setMatchesError(null);
      }
    }
    void loadMatches();
  }, [fixtureId, presetMatch, testingMatch]);

  useEffect(() => {
    if (!selectedMatch) {
      setMetrics([]);
      setPlayerDetailLevel("full");
      return;
    }

    const testingOrPreset = Boolean(testingMatch || presetMatch);
    let cancelled = false;

    /** Durante prefetch massivo: anteprima da cache locale; sync completo al termine del bulk. */
    if (adminBulkRefreshing) {
      const lsWarm = readKioskInsightsLocal(selectedMatch.eventId);
      if (lsWarm?.metrics?.length) {
        setMetrics(lsWarm.metrics);
        setPlayerDetailLevel(lsWarm.playerDetailLevel);
      }
      setLoadingMatchInsights(true);
      setMatchInsightsError(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setLoadingMatchInsights(true);
      setMatchInsightsError(null);

      const orgRow = await fetchOrgKioskInsightsFromApi(selectedMatch.eventId);
      if (cancelled) return;
      if (orgRow) {
        if (!testingOrPreset && accessSummary.isMember) {
          const unlocked = await consumeMemberMatchWeekSlotIfNeeded({
            eventId: selectedMatch.eventId,
            isMember: true
          });
          if (!cancelled && !unlocked.ok) {
            setMetrics([]);
            setPlayerDetailLevel("full");
            setMatchInsightsError(
              unlocked.reason === "limit"
                ? "Hai già scelto 3 partite questa settimana. Potrai selezionarne altre dalla prossima settimana."
                : "Impossibile verificare la quota partite settimanali. Controlla la connessione e riprova."
            );
            setLoadingMatchInsights(false);
            if (unlocked.reason === "limit") {
              void reloadAccessSummary();
            }
            return;
          }
        }

        writeKioskInsightsLocal(selectedMatch.eventId, {
          metrics: orgRow.metrics,
          playerDetailLevel: orgRow.playerDetailLevel,
          insightsSnap: orgRow.insightsSnap
        });
        setMetrics(orgRow.metrics);
        setPlayerDetailLevel(orgRow.playerDetailLevel);
        await reloadAccessSummary();
        setLoadingMatchInsights(false);
        setMatchInsightsError(null);
        return;
      }

      const ls = readKioskInsightsLocal(selectedMatch.eventId);

      if (ls?.metrics?.length) {
        if (!testingOrPreset && accessSummary.isMember) {
          const unlocked = await consumeMemberMatchWeekSlotIfNeeded({
            eventId: selectedMatch.eventId,
            isMember: true
          });
          if (!cancelled && !unlocked.ok) {
            setMetrics([]);
            setPlayerDetailLevel("full");
            setMatchInsightsError(
              unlocked.reason === "limit"
                ? "Hai già scelto 3 partite questa settimana. Potrai selezionarne altre dalla prossima settimana."
                : "Impossibile verificare la quota partite settimanali. Controlla la connessione e riprova."
            );
            setLoadingMatchInsights(false);
            if (unlocked.reason === "limit") {
              void reloadAccessSummary();
            }
            return;
          }
        }

        setMetrics(ls.metrics);
        setPlayerDetailLevel(ls.playerDetailLevel);
        setMatchInsightsError(null);
        setLoadingMatchInsights(false);
        void reloadAccessSummary();
        return;
      }

      if (!cancelled) {
        setMetrics([]);
        setPlayerDetailLevel("full");
        setMatchInsightsError(
          "Analisi giocatori non disponibili per questa partita. Un amministratore deve eseguire «Aggiorna dati admin» dal kiosk: i dati vengono salvati sul database dell’organizzazione e restano consultabili da tutti i dispositivi."
        );
        setLoadingMatchInsights(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMatch, adminBulkRefreshing, testingMatch, presetMatch, accessSummary.isMember]);

  return (
    <section className="space-y-5 rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950/60 via-slate-900/45 to-cyan-950/35 p-3 shadow-[0_24px_70px_rgba(2,6,23,0.28)] ring-1 ring-white/5 sm:space-y-6 sm:p-5">
      <header className="space-y-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-400/12 via-white/[0.045] to-fuchsia-400/10 p-4 sm:p-5">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
            Match dashboard
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{kioskTitle}</h2>
        </div>
        {kioskDescription ? (
          <p className="max-w-3xl text-xs leading-relaxed text-slate-400 sm:text-sm">{kioskDescription}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-2">
          <button
            type="button"
            onClick={() => setView("PLAYER_FRICTION")}
            className={`rounded-full px-6 py-3 text-sm font-bold transition ${
              view === "PLAYER_FRICTION"
                ? "bg-gradient-to-r from-cyan-300 to-blue-400 text-slate-950 shadow-lg shadow-cyan-950/25"
                : "text-slate-300 hover:bg-cyan-300/12 hover:text-cyan-50"
            }`}
          >
            Scontri in campo
          </button>
          <button
            type="button"
            onClick={() => setView("FOUL_RISK_SUFFERED")}
            className={`rounded-full px-6 py-3 text-sm font-bold transition ${
              view === "FOUL_RISK_SUFFERED"
                ? "bg-gradient-to-r from-rose-300 to-orange-300 text-slate-950 shadow-lg shadow-rose-950/25"
                : "text-slate-300 hover:bg-rose-300/12 hover:text-rose-50"
            }`}
          >
            Rischio falli subiti
          </button>
          <button
            type="button"
            onClick={() => setView("FOUL_RISK_COMMITTED")}
            className={`rounded-full px-6 py-3 text-sm font-bold transition ${
              view === "FOUL_RISK_COMMITTED"
                ? "bg-gradient-to-r from-violet-300 to-fuchsia-300 text-slate-950 shadow-lg shadow-fuchsia-950/25"
                : "text-slate-300 hover:bg-fuchsia-300/12 hover:text-fuchsia-50"
            }`}
          >
            Rischio falli commessi
          </button>
          <a
            href="/kiosk/allarme-ammonizioni"
            className="rounded-full border border-yellow-300/35 bg-yellow-300/12 px-6 py-3 text-sm font-bold text-yellow-100 transition hover:border-yellow-200 hover:bg-yellow-300/20"
          >
            Allarme ammonizioni
          </a>
        </div>
      </header>

      {showBookingAlarm ? (
        <article className="rounded-[1.5rem] border border-amber-200/20 bg-gradient-to-br from-amber-300/14 via-orange-400/[0.08] to-rose-400/[0.08] p-4 shadow-[0_16px_45px_rgba(120,53,15,0.16)] ring-1 ring-amber-100/10 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black uppercase tracking-wide text-amber-100">
                Allarme Ammonizione
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-amber-50/80">
                Top 10 globale dei <strong>marcatori a rischio cartellino</strong>: sono i giocatori che dovranno
                marcare avversari con alta media di <strong>falli subiti</strong> e{" "}
                <strong>dribbling riusciti</strong>.
              </p>
            </div>
            <span className="rounded-full border border-amber-200/25 bg-amber-200/12 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-100">
              Solo top 5 campionati
            </span>
          </div>

          {bookingAlarmLeaders === undefined || bookingAlarmLoading ? (
            <p className="text-sm text-amber-50/70">Calcolo dei profili più caldi su tutte le prossime partite…</p>
          ) : bookingAlarmLeaders.length === 0 ? (
            <p className="text-sm text-amber-50/70">
              Nessun profilo forte disponibile al momento: servono media falli subiti, dribbling e matchup sufficienti.
            </p>
          ) : (
            <ol className="grid gap-3 lg:grid-cols-2">
              {bookingAlarmLeaders.map((item, idx) => (
                <li
                  key={`${item.match.eventId}-${item.marker.team}-${item.marker.playerName}`}
                  className="rounded-2xl border border-amber-100/15 bg-slate-950/35 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-amber-200">
                        {idx + 1}. <span className="text-white">{item.marker.playerName}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.marker.team} · {competitionLabel(item.match.competitionSlug)}
                        {item.marker.positionCode ? ` · ${item.marker.positionCode}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100">
                      Score {item.score.toFixed(1)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                    <span className="rounded-xl bg-white/[0.045] px-3 py-2">
                      Falli commessi: <strong className="text-rose-100">{formatStat(item.marker.foulsCommittedSeasonAvg)}</strong>
                    </span>
                    <span className="rounded-xl bg-white/[0.045] px-3 py-2">
                      Avversario: <strong className="text-cyan-100">{item.player.playerName}</strong>
                    </span>
                    <span className="rounded-xl bg-white/[0.045] px-3 py-2">
                      Rating: <strong className="text-amber-100">{starString(item.starRating)}</strong>
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    Prossima partita: <strong>{item.match.homeTeam.name} vs {item.match.awayTeam.name}</strong>.
                    Dovrà marcare <strong>{item.player.playerName}</strong> ({item.player.team}
                    {item.player.positionCode ? `, ${item.player.positionCode}` : ""}), che ha media{" "}
                    <strong>{formatStat(bookingAlarmTargetFouls(item.player))}</strong> falli subiti e{" "}
                    <strong>{formatStat(dribbleSignal(item.player))}</strong> dribbling riusciti a partita.
                  </p>
                </li>
              ))}
            </ol>
          )}
        </article>
      ) : null}

      {showRoundFormSpecial ? (
        <article className={softPanelClass}>
          <h3 className="mb-1 text-base font-bold uppercase tracking-wide text-amber-100">
            Top giornata — {selectedMatch ? competitionLabel(selectedMatch.competitionSlug) : "campionato"}
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            I 5 giocatori più interessanti calcolati sui <strong>matchup delle prossime partite</strong> del campionato
            selezionato, ordinati dal punteggio più alto al più basso.
          </p>
          {roundMatchupUsedFallback ? (
            <p className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100/95">
              Matchup giornata completi non disponibili: classifica provvisoria solo sul match selezionato.
            </p>
          ) : null}
          {roundMatchupLeaders === undefined || roundMatchupLoading ? (
            <p className="text-sm text-slate-400">Caricamento matchup della giornata…</p>
          ) : roundMatchupLeaders ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  ["Top 5 rischio falli commessi", roundMatchupLeaders.committed],
                  ["Top 5 rischio falli subiti", roundMatchupLeaders.suffered]
                ] as const
              ).map(([title, list]) => (
                <div key={title} className={subtleCardClass}>
                  <p className="mb-3 text-base font-bold text-slate-100">{title}</p>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">Nessun dato disponibile.</p>
                  ) : (
                    <ol className="space-y-3 text-sm">
                      {list.map((m, idx) => (
                        <li
                          key={`${title}-${m.match.eventId}-${m.entry.teamId}-${m.entry.playerId ?? m.entry.playerName}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2"
                        >
                          <span className="min-w-0 text-slate-200">
                            <span className="mr-2 font-black text-amber-200">{idx + 1}.</span>
                            <span className="font-bold">{m.entry.playerName}</span>
                            <span className="ml-2 text-slate-400">({m.entry.team})</span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {m.match.homeTeam.name} vs {m.match.awayTeam.name}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-amber-300/15 px-3 py-1 font-bold text-amber-100">
                            {starString(m.entry.starRating)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <div className="space-y-6" id="kiosk-fixture-picker">
        <div className={softPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">1. Scegli il campionato</p>
              <p className="text-sm text-slate-400">2. Clicca una partita e guarda i segnali principali.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {accessSummary.matchUsage.limit != null ? (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                  <span className="font-black">Utilizzi settimanali:</span>{" "}
                  {accessSummary.matchUsage.used}/{accessSummary.matchUsage.limit ?? 3} partite
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-black text-emerald-100">
                  Accesso {accessSummary.isAdmin ? "admin" : "pro"} completo
                </div>
              )}
              {canRefreshData ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!canRefreshData) return;
                    setAdminBulkRefreshing(true);
                    setLoadingMatchInsights(true);
                    setMatchInsightsError(null);
                    setAdminBulkProgress({ current: 0, total: 0 });
                    try {
                      const purgeRes = await fetch("/api/tactical/org-kiosk-match-insights", {
                        method: "DELETE",
                        credentials: "include"
                      });
                      if (!purgeRes.ok) {
                        if (mountedRef.current) {
                          setMatchInsightsError(
                            "Impossibile azzerare gli snapshot precedenti sul server (permessi o connessione). Riprova."
                          );
                        }
                        return;
                      }

                      clearAllKioskInsightsLocal();

                      const snap = bumpAdminInsightsSnap();
                      window.dispatchEvent(
                        new CustomEvent<{ snap: number }>(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, {
                          detail: { snap }
                        })
                      );
                      const topFiveTargets = dedupeMatchesByEventId(upcomingMatches).filter((m) =>
                        isTopFiveLeagueSlug(m.competitionSlug)
                      );
                      const total = topFiveTargets.length;
                      if (mountedRef.current) {
                        setAdminBulkProgress(total > 0 ? { current: 0, total } : { current: 0, total: 0 });
                      }
                      await prefetchAllMenuInsights(topFiveTargets, snap, (current, tot) => {
                        if (mountedRef.current) setAdminBulkProgress({ current, total: tot });
                      });
                      /** Riduce mismatch menu DB vs prefetch: ripersiste il calendario condiviso lato admin. */
                      await fetch("/api/tactical/matches", { cache: "no-store", credentials: "include" });
                    } finally {
                      if (mountedRef.current) {
                        setAdminBulkRefreshing(false);
                        setLoadingMatchInsights(false);
                        setAdminBulkProgress(null);
                      }
                      void reloadAccessSummary();
                    }
                  }}
                  disabled={loadingMatchInsights || adminBulkRefreshing}
                  className={primaryButtonClass}
                >
                  Aggiorna dati admin
                </button>
              ) : null}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {leagueFilterSlugs.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    setSelectedCompetition(slug);
                    setSelectedMatchId(0);
                  }}
                  className={`rounded-full border px-6 py-3 text-sm font-bold transition hover:scale-[1.02] ${
                    selectedCompetition && normalizeKioskCompetitionSlug(selectedCompetition) === slug
                      ? "border-cyan-200/70 bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-950/25"
                      : "border-white/10 bg-white/[0.055] text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-300/12 hover:text-cyan-50"
                  }`}
                >
                  {competitionLabel(slug)}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {visibleMatches.map((match) => (
                <button
                  key={match.eventId}
                  type="button"
                  onClick={() => setSelectedMatchId(match.eventId)}
                  className={`rounded-[1.35rem] border p-5 text-left transition hover:translate-y-[-1px] ${
                    selectedMatch?.eventId === match.eventId
                      ? "border-cyan-200/70 bg-gradient-to-br from-cyan-400/22 via-blue-400/12 to-fuchsia-400/14 shadow-lg shadow-cyan-950/25"
                      : "border-white/10 bg-gradient-to-br from-white/[0.065] to-white/[0.025] hover:border-cyan-300/35 hover:bg-cyan-300/10"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                    {competitionLabel(match.competitionSlug)}
                  </p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {match.homeTeam.name} vs {match.awayTeam.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">Calcio d&apos;inizio: {formatKickoff(match.startTimestamp)}</p>
                </button>
              ))}
            </div>

          {presetMatch && !matchesError && matches.length === 0 ? (
            <p className={infoBoxClass}>
              La partita preimpostata ha già calcio d&apos;inizio passato: non viene mostrata nel menu.
            </p>
          ) : null}
          {!presetMatch && !matchesError && matches.length === 0 ? (
            <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Nessuna partita nel menu: controlla la chiave SportAPI, il budget e le variabili d&apos;ambiente del
              calendario (es. <code className="text-xs">TACTICAL_LOOKAHEAD_DAYS</code>). Senza partite non è possibile
              caricare le analisi giocatori.
            </p>
          ) : null}
          {!matchesError && matches.length > 0 && !selectedCompetition ? (
            <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
              Seleziona un <strong>campionato</strong> (pulsanti sopra) per vedere le partite e le statistiche.
            </p>
          ) : null}
          {!matchesError && matches.length > 0 && upcomingMatches.length === 0 ? (
            <p className={infoBoxClass}>
              Tutte le partite caricate hanno già il calcio d’inizio nel passato: in menu restano solo match non ancora
              giocati.
            </p>
          ) : null}
          {upcomingMatches.length > 0 && !selectedMatch ? (
            <p className="text-sm text-slate-400">Seleziona una partita dalla lista sopra.</p>
          ) : null}

          {matchesError ? <p className="text-sm text-rose-300">{matchesError}</p> : null}

          {(loadingMatchInsights && !adminBulkRefreshing) && selectedMatch ? (
            <p className="text-sm text-slate-400">Caricamento analisi giocatori…</p>
          ) : null}
          {matchInsightsError ? <p className="text-sm text-rose-300">{matchInsightsError}</p> : null}
          {playerDetailLevel === "team_only" ? (
            <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Per questa competizione il menu ibrido non carica l&apos;analisi giocatori (es.{" "}
              <strong>Serie B</strong>). Restano attive <strong>Serie A</strong>,{" "}
              <strong>Champions League</strong>, <strong>Europa League</strong> e{" "}
              <strong>Conference League</strong> (con squadre di Serie A) per scontri e heatmap.
            </p>
          ) : null}
        </div>
        </div>

        <div className="space-y-4">
          {playerDetailLevel === "team_only" ? (
            <div className={`${softPanelClass} text-center`}>
              <p className="text-base text-slate-200">
                Per questa lega non sono disponibili scontri in campo nè heatmap giocatori nel menu ibrido.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Le analisi giocatori restano attive per Serie A, Champions League, Europa League e Conference League
                (con squadre di Serie A), per limitare le chiamate API.
              </p>
            </div>
          ) : (
            <>
              {playerAnalyticsView === "PLAYER_FRICTION" ? (
                <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-relaxed text-cyan-50">
                  Focus su pochi duelli: dove i profili statistici si incrociano sulla medesima fascia con possibile
                  contatto ripetuto e cartellino verso.
                </p>
              ) : null}

              {playerAnalyticsView === "PLAYER_FRICTION" ? (
                <>
                  {!hasMatchFrameHeatmaps ? (
                    <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                      Heatmap giocatore nel frame partita non disponibili (cache precedente). Ricarica i dati del match o
                      attendi il prossimo aggiornamento insights.
                    </p>
                  ) : null}

                  {matchFrictionPairs.length === 0 ? (
                    <p className="text-sm text-amber-200">
                      Per questa partita non risultano matchup con incrocio tattico e profilo falli abbastanza forte.
                    </p>
                  ) : matchFrictionPairs.length > 1 && frictionDetailIndex === null ? (
                    <div className="space-y-3">
                      {matchFrictionPairs.map((pair, idx) => (
                        <button
                          key={`${pair.left.playerName}-${pair.right.playerName}-${idx}`}
                          type="button"
                          onClick={() => setFrictionDetailIndex(idx)}
                          className={`${softPanelClass} w-full text-left transition hover:border-cyan-400/35 hover:shadow-cyan-500/10`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                            Scontro {idx + 1} — tra i più interessanti
                          </p>
                          <p className="mt-2 text-lg font-bold text-white">
                            {pair.left.playerName}{" "}
                            <span className="mx-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                              vs
                            </span>{" "}
                            {pair.right.playerName}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">
                            {(pair.left.sparkNarrative || "").slice(0, 220)}
                            {(pair.left.sparkNarrative?.length ?? 0) > 220 ? "…" : ""}
                          </p>
                          <span className="mt-4 inline-flex text-xs font-semibold text-cyan-300">Apri dettaglio →</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    (() => {
                      const idx = matchFrictionPairs.length === 1 ? 0 : frictionDetailIndex ?? 0;
                      const pair = matchFrictionPairs[idx];
                      if (!pair) return null;
                      const model = buildMatchupDetailModel(idx + 1, pair.left, pair.right);
                      return (
                        <MatchupDetailPage
                          model={model}
                          showBackLink={matchFrictionPairs.length > 1}
                          onBack={() => setFrictionDetailIndex(null)}
                        />
                      );
                    })()
                  )}
                </>
              ) : playerAnalyticsView === "FOUL_RISK_SUFFERED" ? (
                selectedMatch ? (
                  <FoulSufferedRiskPanel
                    fixtureId={fixtureId}
                    entries={foulRiskSufferedEntries}
                    selectedMatch={selectedMatch}
                    selectedMatchMetrics={selectedMatchMetrics}
                    selectedMetricsByRosterKey={selectedMetricsByRosterKey}
                    leagueFilterSlugs={leagueFilterSlugs}
                    selectedCompetitionNormalized={
                      selectedCompetition ? normalizeKioskCompetitionSlug(selectedCompetition) : ""
                    }
                    onSelectCompetitionSlug={(slug) => {
                      setSelectedCompetition(slug);
                      setSelectedMatchId(0);
                    }}
                    competitionLabel={competitionLabel}
                    accessSummary={accessSummary}
                    normalizePlayerName={normalizePlayerName}
                    simpleLevelFromScore={simpleLevelFromScore}
                    onOpenCommittedView={() => setView("FOUL_RISK_COMMITTED")}
                  />
                ) : (
                  <p className="text-sm text-slate-400">
                    Seleziona una partita per consultare il rischio falli subiti.
                  </p>
                )
              ) : playerAnalyticsView === "FOUL_RISK_COMMITTED" ? (
                selectedMatch ? (
                  <FoulCommittedRiskPanel
                    fixtureId={fixtureId}
                    entries={foulRiskCommittedEntries}
                    selectedMatch={selectedMatch}
                    selectedMatchMetrics={selectedMatchMetrics}
                    selectedMetricsByRosterKey={selectedMetricsByRosterKey}
                    leagueFilterSlugs={leagueFilterSlugs}
                    selectedCompetitionNormalized={
                      selectedCompetition ? normalizeKioskCompetitionSlug(selectedCompetition) : ""
                    }
                    onSelectCompetitionSlug={(slug) => {
                      setSelectedCompetition(slug);
                      setSelectedMatchId(0);
                    }}
                    competitionLabel={competitionLabel}
                    accessSummary={accessSummary}
                    normalizePlayerName={normalizePlayerName}
                    simpleLevelFromScore={simpleLevelFromScore}
                    onOpenSufferedView={() => setView("FOUL_RISK_SUFFERED")}
                  />
                ) : (
                  <p className="text-sm text-slate-400">
                    Seleziona una partita per consultare il rischio falli commessi.
                  </p>
                )
              ) : null}
            </>
          )}
        </div>
      </div>

      {adminBulkRefreshing && adminBulkProgress ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050814]/92 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-300/25 bg-[#07111F] p-6 shadow-2xl">
            <p className="text-center text-sm font-bold uppercase tracking-wide text-cyan-200">
              Aggiornamento dati admin
            </p>
            <p className="mt-2 text-center text-xs leading-relaxed text-slate-400">
              Ricalcolo match-insights con heatmap per tutte le partite future dei{" "}
              <strong className="text-slate-300">top 5 campionati</strong> presenti nel menu (Serie A, Premier League,
              LaLiga, Bundesliga, Ligue 1).
            </p>
            <p className="mt-4 text-center text-sm text-slate-300">
              {adminBulkProgress.total > 0 ? (
                <>
                  Partite elaborate:{" "}
                  <strong className="text-white">{adminBulkProgress.current}</strong> di{" "}
                  <strong className="text-white">{adminBulkProgress.total}</strong>
                </>
              ) : (
                <span>Preparazione elenco partite top 5…</span>
              )}
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              {adminBulkProgress.total > 0 && adminBulkProgress.total - adminBulkProgress.current > 0
                ? `Mancano ancora ${adminBulkProgress.total - adminBulkProgress.current} partit${
                    adminBulkProgress.total - adminBulkProgress.current === 1 ? "a" : "e"
                  } da aggiornare.`
                : adminBulkProgress.total === 0
                  ? "Se il contatore resta a zero, non ci sono match futuri dei top 5 nel menu caricato."
                  : "Finalizzazione cache locale…"}
            </p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300 ${
                  adminBulkProgress.total === 0 ? "animate-pulse" : ""
                }`}
                style={{
                  width:
                    adminBulkProgress.total > 0
                      ? `${Math.min(100, (adminBulkProgress.current / adminBulkProgress.total) * 100)}%`
                      : "38%"
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
