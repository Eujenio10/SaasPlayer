import type { UserAccessRole } from "@/lib/types";

export interface DataRefreshStatus {
  timezone: string;
  scheduleHour: number;
  scheduleLabel: string;
  nextScheduledAt: string;
  lastRefreshAt: string | null;
  lastRefreshLabel: string | null;
  automatedDailyRefresh: true;
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
}

export type HomeDashboardRoute =
  | "/"
  | "/matches"
  | "/profile"
  | `/match/${string}`;
