import type { DataRefreshStatus } from "@/lib/data-refresh/status";
import type { UserAccessRole } from "@/lib/auth/organization";
import type { UserAccessSummary } from "@/lib/auth/user-access";
import {
  formatMonitoredCompetitionLabel,
  resolveMatchCompetitionId,
  type MonitoredCompetitionId
} from "@/lib/competitions";
import { computeMatchIntensityPreview } from "@/lib/intensity-analysis";
import {
  EARLY_SEASON_BANNER_MESSAGE,
  isEarlySeasonWindow
} from "@/lib/season-fallback/early-season-window";
import {
  combinePersistedOrganizationMenuSnapshots,
  filterMatchesKickoffInFuture,
  pickNearestUpcomingMatch
} from "@/lib/tactical-matches-filters";
import type { TacticalMetrics } from "@/lib/types";
import {
  pruneYellowCardSnapshotToScheduledFuture
} from "@/lib/yellow-card-schedule-utils";
import type { UpcomingMatchItem } from "@/services/sportapi";

const HOME_FEATURED_COMPETITIONS = new Set<MonitoredCompetitionId>(["serie-a", "world-cup"]);

/** Prossima partita in calendario limitata a Serie A e Mondiali. */
export function filterHomeFeaturedCompetitionMatches(
  matches: UpcomingMatchItem[]
): UpcomingMatchItem[] {
  return matches.filter((match) => {
    const competitionId = resolveMatchCompetitionId(match);
    return competitionId != null && HOME_FEATURED_COMPETITIONS.has(competitionId);
  });
}

export function pickHomeFeaturedMatch(matches: UpcomingMatchItem[]): UpcomingMatchItem | null {
  const upcoming = filterMatchesKickoffInFuture(matches);
  return pickNearestUpcomingMatch(filterHomeFeaturedCompetitionMatches(upcoming));
}

export interface HomeDashboardUser {
  email: string;
  planName: string;
  accessStatus: "active" | "inactive";
  role: UserAccessRole;
}

export interface HomeTodaySummary {
  monitoredMatchesCount: number;
  keyDuelsCount: number | null;
  foulsSignalsCount: number | null;
}

export interface HomeFeaturedMatch {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  competitionName: string;
  kickoffTime: string;
  kickoffLabel: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamShortName: string;
  awayTeamShortName: string;
  homeTeamInitials: string;
  awayTeamInitials: string;
  homeTeamColor: string;
  awayTeamColor: string;
  intensityLabel: string;
  intensityLevel: "low" | "medium" | "high";
  matchIntensityValue: number | null;
  matchIntensityLevel: "low" | "medium" | "high" | "very_high" | null;
  keyDuelsCount: number | null;
  averageFouls: number | null;
  cardRiskIndex: number | null;
  trend: "up" | "down" | "stable" | null;
}

export interface HomeModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
  enabled: boolean;
  badge: string | null;
}

export interface HomeQuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  enabled: boolean;
}

export interface HomeDashboardData {
  user: HomeDashboardUser;
  todaySummary: HomeTodaySummary;
  featuredMatch: HomeFeaturedMatch | null;
  modules: HomeModule[];
  quickActions: HomeQuickAction[];
  dataRefresh: DataRefreshStatus;
  /** Messaggio da mostrare in homepage nelle prime giornate di stagione, altrimenti null. */
  earlySeasonNotice: string | null;
}

const GENERIC_TEAM_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#06B6D4",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#F97316",
  "#A855F7"
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function genericTeamColor(teamName: string): string {
  return GENERIC_TEAM_COLORS[hashSeed(teamName.toLowerCase()) % GENERIC_TEAM_COLORS.length]!;
}

export function teamInitialsFromName(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  if (!clean) return "—";
  const words = clean.split(/\s+/).filter((w) => !["FC", "AC", "AS", "CF", "SC", "US"].includes(w.toUpperCase()));
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
  }
  const token = words[0] ?? clean;
  return token.slice(0, 3).toUpperCase();
}

export function teamShortName(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter((w) => !["FC", "AC", "AS", "CF", "SC", "US"].includes(w.toUpperCase()));
  return (words[0] ?? clean).slice(0, 12);
}

function kickoffDateKeyRome(startTimestampSec: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(startTimestampSec * 1000));
}

function todayDateKeyRome(nowMs = Date.now()): string {
  return kickoffDateKeyRome(Math.floor(nowMs / 1000));
}

export function formatKickoffLabelRome(startTimestampSec: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(startTimestampSec * 1000));
}

function planNameFromRole(role: UserAccessRole, guestMode?: boolean): string {
  if (guestMode) return "Guest";
  if (role === "admin") return "Admin";
  if (role === "pro") return "Pro";
  return "Membro";
}

function intensityFromScore(score: number): { label: string; level: "low" | "medium" | "high" } {
  if (score >= 16) return { label: "Intensità alta", level: "high" };
  if (score >= 10) return { label: "Intensità media", level: "medium" };
  return { label: "Intensità contenuta", level: "low" };
}

function metricsKeyDuels(metrics: TacticalMetrics[]): number {
  return metrics.filter((m) => m.sparkDuel != null || m.sparkIndex >= 5).length;
}

function metricsAverageFouls(metrics: TacticalMetrics[]): number | null {
  const values: number[] = [];
  for (const m of metrics) {
    const committed = m.foulsCommittedSeasonAvg;
    const suffered = m.foulsSufferedSeasonAvg;
    if (typeof committed === "number" && Number.isFinite(committed)) values.push(committed);
    if (typeof suffered === "number" && Number.isFinite(suffered)) values.push(suffered);
  }
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function cardRiskForEvent(
  rows: Array<{ eventId?: number; riskScore?: number; riskLevel?: string }>,
  eventId: number
): number | null {
  const scoped = rows.filter((r) => r.eventId === eventId);
  if (!scoped.length) return null;
  const max = Math.max(...scoped.map((r) => (typeof r.riskScore === "number" ? r.riskScore : 0)));
  return Math.round(max * 10) / 10;
}

function buildModules(access: UserAccessSummary, guestMode?: boolean): HomeModule[] {
  const proOrAdmin = access.isPro || access.isAdmin;
  return [
    {
      id: "matchups",
      title: "Analisi partita",
      description: "Scontri in campo, falli e heatmap per ogni match.",
      icon: "git-compare",
      color: "#67E8F9",
      route: "/matches",
      enabled: true,
      badge: null
    },
    {
      id: "markings",
      title: "Marcature difficili",
      description: "Duelli individuali con indice di esposizione alla marcatura.",
      icon: "shield",
      color: "#FB923C",
      route: "/markings",
      enabled: true,
      badge: proOrAdmin ? null : "PRO"
    },
    {
      id: "trends",
      title: "Trend",
      description: "Giocatori in crescita su tiri, parate e presenze recenti.",
      icon: "trending-up",
      color: "#FCD34D",
      route: "/trends",
      enabled: true,
      badge: null
    },
    {
      id: "simulator",
      title: "Simulatore match",
      description: "Scenario statistico pre-partita con simulazioni Monte Carlo.",
      icon: "stats-chart",
      color: "#34D399",
      route: "/simulator",
      enabled: true,
      badge: guestMode && !proOrAdmin ? "ADS" : null
    },
    {
      id: "advanced-stats",
      title: "Statistiche avanzate",
      description: "Metriche esclusive per leggere il gioco in profondità.",
      icon: "bar-chart",
      color: "#A78BFA",
      route: "/matches",
      enabled: access.isPro || access.isAdmin,
      badge: access.isPro || access.isAdmin ? "PRO" : "In arrivo"
    }
  ];
}

function buildQuickActions(access: UserAccessSummary): HomeQuickAction[] {
  void access;
  return [
    { id: "matches", label: "Analisi partita", icon: "football", route: "/matches", enabled: true },
    { id: "markings", label: "Marcature", icon: "shield", route: "/markings", enabled: true },
    { id: "trends", label: "Trend", icon: "trending-up", route: "/trends", enabled: true },
    { id: "simulator", label: "Simulatore", icon: "stats-chart", route: "/simulator", enabled: true }
  ];
}

export function buildHomeDashboard(params: {
  email: string;
  access: UserAccessSummary;
  matches: UpcomingMatchItem[];
  yellowRows: Array<{ eventId?: number; riskScore?: number; riskLevel?: string }>;
  featuredMetrics: TacticalMetrics[];
  featuredEventId: number | null;
  guestMode?: boolean;
  dataRefresh: DataRefreshStatus;
}): HomeDashboardData {
  const { email, access, matches, yellowRows, featuredMetrics, featuredEventId, guestMode, dataRefresh } =
    params;
  const upcoming = filterMatchesKickoffInFuture(matches);
  const todayKey = todayDateKeyRome();
  const matchesToday = upcoming.filter((m) => kickoffDateKeyRome(m.startTimestamp) === todayKey);

  /**
   * Anteprima home: prossima partita futura tra Serie A e Mondiali.
   * Se il chiamante ha già indicato un evento (metriche pre-caricate), usiamo quello se ancora valido.
   */
  const eligibleUpcoming = filterHomeFeaturedCompetitionMatches(upcoming);
  const nearest = pickNearestUpcomingMatch(eligibleUpcoming);
  const featuredFromId =
    featuredEventId != null
      ? eligibleUpcoming.find((m) => m.eventId === featuredEventId)
      : undefined;
  const featured = featuredFromId ?? nearest;

  const keyDuelsFromFeatured = featuredMetrics.length ? metricsKeyDuels(featuredMetrics) : null;
  const foulsFromFeatured = featuredMetrics.length ? metricsAverageFouls(featuredMetrics) : null;

  let featuredMatch: HomeFeaturedMatch | null = null;
  if (featured) {
    const cardRisk = cardRiskForEvent(yellowRows, featured.eventId);
    const intensityPreview = featuredMetrics.length
      ? computeMatchIntensityPreview(featuredMetrics)
      : null;
    const fallbackIntensity = intensityFromScore((cardRisk ?? 0) + (keyDuelsFromFeatured ?? 0) * 2);
    featuredMatch = {
      id: featured.eventId,
      homeTeamId: featured.homeTeam.id,
      awayTeamId: featured.awayTeam.id,
      competitionName:
        formatMonitoredCompetitionLabel(resolveMatchCompetitionId(featured) ?? featured.competitionSlug) ||
        featured.competitionName?.trim() ||
        featured.competitionSlug,
      kickoffTime: new Date(featured.startTimestamp * 1000).toISOString(),
      kickoffLabel: formatKickoffLabelRome(featured.startTimestamp),
      homeTeamName: featured.homeTeam.name,
      awayTeamName: featured.awayTeam.name,
      homeTeamShortName: teamShortName(featured.homeTeam.name),
      awayTeamShortName: teamShortName(featured.awayTeam.name),
      homeTeamInitials: teamInitialsFromName(featured.homeTeam.name),
      awayTeamInitials: teamInitialsFromName(featured.awayTeam.name),
      homeTeamColor: genericTeamColor(featured.homeTeam.name),
      awayTeamColor: genericTeamColor(featured.awayTeam.name),
      intensityLabel: intensityPreview?.label ?? fallbackIntensity.label,
      intensityLevel: intensityPreview?.uiLevel ?? fallbackIntensity.level,
      matchIntensityValue: intensityPreview?.value ?? null,
      matchIntensityLevel: intensityPreview?.level ?? null,
      keyDuelsCount: keyDuelsFromFeatured,
      averageFouls: foulsFromFeatured,
      cardRiskIndex: cardRisk,
      trend: cardRisk != null && cardRisk >= 14 ? "up" : cardRisk != null && cardRisk < 8 ? "down" : "stable"
    };
  }

  return {
    user: {
      email,
      planName: planNameFromRole(access.role, guestMode),
      accessStatus: guestMode ? "inactive" : "active",
      role: access.role
    },
    todaySummary: {
      monitoredMatchesCount: matchesToday.length,
      keyDuelsCount: keyDuelsFromFeatured,
      foulsSignalsCount: foulsFromFeatured
    },
    featuredMatch,
    modules: buildModules(access, guestMode),
    quickActions: buildQuickActions(access),
    dataRefresh,
    earlySeasonNotice: isEarlySeasonWindow() ? EARLY_SEASON_BANNER_MESSAGE : null
  };
}

export async function loadOrganizationMatches(
  supabase: ReturnType<typeof import("@/lib/auth/get-api-user").createApiSupabaseClient>,
  organizationId: string
): Promise<UpcomingMatchItem[]> {
  const { data: row } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const domestic = Array.isArray(row?.matches) ? (row.matches as UpcomingMatchItem[]) : [];

  const { data: intlRow } = await supabase
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const international = Array.isArray(intlRow?.matches) ? (intlRow.matches as UpcomingMatchItem[]) : [];

  return combinePersistedOrganizationMenuSnapshots(domestic, international);
}

export function parseYellowCardRows(snapshot: unknown): Array<{
  eventId?: number;
  riskScore?: number;
  riskLevel?: string;
}> {
  if (!snapshot || typeof snapshot !== "object") return [];
  const snap = snapshot as { rows?: unknown[] };
  if (!Array.isArray(snap.rows)) return [];
  return snap.rows as Array<{ eventId?: number; riskScore?: number; riskLevel?: string }>;
}

export function prunedYellowRows(
  matches: UpcomingMatchItem[],
  rows: Array<{ eventId?: number; riskScore?: number; riskLevel?: string }>
): Array<{ eventId?: number; riskScore?: number; riskLevel?: string }> {
  const pruned = pruneYellowCardSnapshotToScheduledFuture({ matches, rows });
  return pruned?.rows ?? [];
}
