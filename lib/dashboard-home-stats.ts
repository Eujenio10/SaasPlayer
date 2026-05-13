import type { UpcomingMatchItem } from "@/services/sportapi";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import {
  KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX,
  kioskInsightsAlignedWithSnap,
  readAdminInsightsSnap,
  readKioskInsightsLocal,
  type KioskInsightsLocalRecord
} from "@/lib/kiosk-persisted-insights";
import {
  countYellowCardHighRiskRows,
  pruneYellowCardSnapshotToScheduledFuture,
  type YellowCardStoredSnapshot
} from "@/lib/yellow-card-schedule-utils";

/** Allineato a `yellow-card-risk-page.tsx`. */
export const YELLOW_CARD_SNAPSHOT_STORAGE_KEY = "yellow-card-risk:snapshot:v2";

export type DashboardMonitorCard = {
  key: string;
  competition: string;
  time: string;
  home: string;
  away: string;
  colors: [string, string];
};

export type DashboardLiveStats = {
  matchesTodayCount: number;
  playersAnalyzedUnique: number;
  yellowAlertsCount: number;
  lastInsightIso: string | null;
  lastYellowIso: string | null;
  monitorMatches: DashboardMonitorCard[];
};

const TEAM_COLOR_CLASSES = [
  "bg-red-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-fuchsia-500"
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickTeamAccentClass(teamName: string): string {
  return TEAM_COLOR_CLASSES[hashSeed(teamName.toLowerCase()) % TEAM_COLOR_CLASSES.length];
}

function abbrevTeam(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter((word) => !["FC", "AC", "AS", "CF", "SC", "US"].includes(word.toUpperCase()));
  return (words[0] ?? clean).slice(0, 3).toUpperCase();
}

/** Data locale (calendario) a Roma per confronti giornalieri. */
export function kickoffDateKeyRome(startTimestampSec: number): string {
  const d = new Date(startTimestampSec * 1000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

export function todayDateKeyRome(nowMs = Date.now()): string {
  return kickoffDateKeyRome(Math.floor(nowMs / 1000));
}

function formatKickoffClockRome(startTimestampSec: number): string {
  const d = new Date(startTimestampSec * 1000);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

function stablePlayerKey(m: {
  playerId?: number;
  teamId?: number;
  playerName?: string;
}): string {
  if (typeof m.playerId === "number" && m.playerId > 0) return `id:${m.playerId}`;
  const tid = typeof m.teamId === "number" ? m.teamId : 0;
  const name = (m.playerName ?? "").trim().toUpperCase();
  return `t:${tid}|${name}`;
}

/** Giocatori unici nei record kiosk allineati all’ondata admin corrente. */
export function aggregateKioskInsightsUniquePlayers(insightsSnap: number): {
  count: number;
  lastSavedIso: string | null;
} {
  if (typeof window === "undefined") return { count: 0, lastSavedIso: null };

  const keys = new Set<string>();
  let lastMs = 0;
  let lastSavedIso: string | null = null;

  for (let i = 0; i < window.localStorage.length; i++) {
    const storageKey = window.localStorage.key(i);
    if (!storageKey?.startsWith(KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX)) continue;
    const suffix = storageKey.slice(KIOSK_INSIGHTS_LOCAL_STORAGE_PREFIX.length);
    const eventId = Number(suffix);
    if (!Number.isFinite(eventId)) continue;

    const rec = readKioskInsightsLocal(eventId) as KioskInsightsLocalRecord | null;
    if (!rec?.metrics?.length || !kioskInsightsAlignedWithSnap(rec, insightsSnap)) continue;

    const savedMs = Date.parse(rec.savedAt);
    if (Number.isFinite(savedMs) && savedMs >= lastMs) {
      lastMs = savedMs;
      lastSavedIso = rec.savedAt;
    }

    for (const row of rec.metrics) {
      keys.add(stablePlayerKey(row));
    }
  }

  return { count: keys.size, lastSavedIso };
}

/** Numero profili ad alto rischio nello snapshot allarme ammonizioni, solo se allineato a partite future. */
export function countYellowCardAlertsFromStorage(threshold = 14): {
  count: number;
  savedAtIso: string | null;
} {
  if (typeof window === "undefined") return { count: 0, savedAtIso: null };
  try {
    const raw = window.localStorage.getItem(YELLOW_CARD_SNAPSHOT_STORAGE_KEY);
    if (!raw) return { count: 0, savedAtIso: null };
    const parsed = JSON.parse(raw) as YellowCardStoredSnapshot;
    const pruned = pruneYellowCardSnapshotToScheduledFuture(parsed);
    if (!pruned) {
      return { count: 0, savedAtIso: null };
    }
    const count = countYellowCardHighRiskRows(pruned, threshold);
    return {
      count,
      savedAtIso: typeof parsed.savedAt === "string" ? parsed.savedAt : null
    };
  } catch {
    return { count: 0, savedAtIso: null };
  }
}

export function buildDashboardLiveStats(
  matches: UpcomingMatchItem[],
  options?: { includeBrowserCache?: boolean }
): DashboardLiveStats {
  const upcoming = filterMatchesKickoffInFuture(matches);
  const todayKey = todayDateKeyRome();

  const matchesTodayCount = upcoming.filter((m) => kickoffDateKeyRome(m.startTimestamp) === todayKey).length;

  const sorted = [...upcoming].sort((a, b) => a.startTimestamp - b.startTimestamp);
  const monitorMatches: DashboardMonitorCard[] = sorted.slice(0, 4).map((m) => ({
    key: `ev-${m.eventId}`,
    competition: m.competitionName?.trim() || m.competitionSlug.replace(/-/g, " ").toUpperCase(),
    time: formatKickoffClockRome(m.startTimestamp),
    home: abbrevTeam(m.homeTeam.name),
    away: abbrevTeam(m.awayTeam.name),
    colors: [pickTeamAccentClass(m.homeTeam.name), pickTeamAccentClass(m.awayTeam.name)]
  }));

  /** Evita errori di idratazione: localStorage non va letto finché il client non è montato. */
  const readCache = options?.includeBrowserCache === true && typeof window !== "undefined";

  const insightsSnap = readCache ? readAdminInsightsSnap() : 0;
  const kioskAgg = readCache
    ? aggregateKioskInsightsUniquePlayers(insightsSnap)
    : { count: 0, lastSavedIso: null };
  const yellowAgg = readCache ? countYellowCardAlertsFromStorage() : { count: 0, savedAtIso: null };

  let lastInsightIso: string | null = kioskAgg.lastSavedIso;
  if (yellowAgg.savedAtIso) {
    const y = Date.parse(yellowAgg.savedAtIso);
    const k = lastInsightIso ? Date.parse(lastInsightIso) : 0;
    if (Number.isFinite(y) && (!Number.isFinite(k) || y > k)) lastInsightIso = yellowAgg.savedAtIso;
  }

  return {
    matchesTodayCount,
    playersAnalyzedUnique: kioskAgg.count,
    yellowAlertsCount: yellowAgg.count,
    lastInsightIso,
    lastYellowIso: yellowAgg.savedAtIso,
    monitorMatches
  };
}
