import { ACTIVE_MENU_COMPETITIONS, formatMonitoredCompetitionLabel } from "@/lib/competitions";
import {
  DATA_REFRESH_CONFIG,
  MORNING_REFRESH_COMPETITION_SLUGS
} from "@/lib/data-refresh/config";

export type MorningRefreshJobStatus = "running" | "done" | "failed";
export type MorningRefreshPhase = "start" | "insights" | "finalize";

export interface MorningTickResultLike {
  ok: boolean;
  nextPhase?: MorningRefreshPhase;
  nextInsightsOffset?: number;
  insightsTotal?: number;
  insightsSnap?: number;
  error?: string;
}

export interface MorningRefreshJob {
  dateKey: string;
  status: MorningRefreshJobStatus;
  phase: MorningRefreshPhase;
  competitionIndex: number;
  insightsOffset: number;
  insightsSnap: number;
  completedSlugs: string[];
  failedSlugs: string[];
  tickCount: number;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
}

export function morningRefreshSlugs(): string[] {
  const active = new Set(ACTIVE_MENU_COMPETITIONS.map((competition) => competition.id));
  return MORNING_REFRESH_COMPETITION_SLUGS.filter((slug) => active.has(slug));
}

export function createMorningRefreshJob(dateKey: string, now = new Date()): MorningRefreshJob {
  const iso = now.toISOString();
  return {
    dateKey,
    status: "running",
    phase: "start",
    competitionIndex: 0,
    insightsOffset: 0,
    insightsSnap: 0,
    completedSlugs: [],
    failedSlugs: [],
    tickCount: 0,
    startedAt: iso,
    updatedAt: iso
  };
}

export function parseMorningRefreshJob(raw: unknown): MorningRefreshJob | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.dateKey !== "string") return null;
  if (value.status !== "running" && value.status !== "done" && value.status !== "failed") {
    return null;
  }
  if (value.phase !== "start" && value.phase !== "insights" && value.phase !== "finalize") {
    return null;
  }
  return {
    dateKey: value.dateKey,
    status: value.status,
    phase: value.phase,
    competitionIndex: Number(value.competitionIndex) || 0,
    insightsOffset: Number(value.insightsOffset) || 0,
    insightsSnap: Number(value.insightsSnap) || 0,
    completedSlugs: Array.isArray(value.completedSlugs)
      ? value.completedSlugs.filter((slug): slug is string => typeof slug === "string")
      : [],
    failedSlugs: Array.isArray(value.failedSlugs)
      ? value.failedSlugs.filter((slug): slug is string => typeof slug === "string")
      : [],
    tickCount: Number(value.tickCount) || 0,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    lastError: typeof value.lastError === "string" ? value.lastError : undefined
  };
}

export function currentMorningCompetitionSlug(job: MorningRefreshJob): string | undefined {
  if (job.phase === "start") return undefined;
  return morningRefreshSlugs()[job.competitionIndex];
}

export function morningRefreshProgressLabel(job: MorningRefreshJob | null): string | null {
  if (!job || job.status !== "running") return null;
  if (job.phase === "start") return "calendario partite";
  const slug = currentMorningCompetitionSlug(job);
  return slug ? formatMonitoredCompetitionLabel(slug) || slug : null;
}

export function advanceMorningJobAfterTick(
  job: MorningRefreshJob,
  result: MorningTickResultLike,
  now = new Date()
): { job: MorningRefreshJob; shouldContinue: boolean } {
  const slugs = morningRefreshSlugs();
  const next: MorningRefreshJob = {
    ...job,
    tickCount: job.tickCount + 1,
    updatedAt: now.toISOString(),
    lastError: result.ok ? undefined : result.error
  };

  if (next.tickCount >= DATA_REFRESH_CONFIG.maxTicksPerDay) {
    next.status = "failed";
    next.lastError = next.lastError ?? "max_ticks_exceeded";
    return { job: next, shouldContinue: false };
  }

  if (job.phase === "start") {
    if (!result.ok) {
      if (next.tickCount >= 6) {
        next.status = "failed";
        return { job: next, shouldContinue: false };
      }
      return { job: next, shouldContinue: true };
    }
    next.insightsSnap = result.insightsSnap ?? Math.floor(now.getTime() / 1000);
    next.phase = slugs.length === 0 ? "finalize" : "insights";
    next.competitionIndex = 0;
    next.insightsOffset = 0;
    if (slugs.length === 0) {
      next.status = "done";
      return { job: next, shouldContinue: false };
    }
    return { job: next, shouldContinue: true };
  }

  const slug = slugs[job.competitionIndex];

  if (job.phase === "insights") {
    if (!result.ok) {
      if (next.tickCount >= DATA_REFRESH_CONFIG.maxTicksPerDay) {
        next.status = "failed";
        return { job: next, shouldContinue: false };
      }
      return { job: next, shouldContinue: true };
    }
    const insightsDone =
      result.nextPhase === "finalize" ||
      (typeof result.insightsTotal === "number" &&
        (result.nextInsightsOffset ?? 0) >= result.insightsTotal);
    if (insightsDone) {
      next.phase = "finalize";
      next.insightsSnap = result.insightsSnap ?? next.insightsSnap;
    } else {
      next.insightsOffset = result.nextInsightsOffset ?? next.insightsOffset;
      next.insightsSnap = result.insightsSnap ?? next.insightsSnap;
    }
    return { job: next, shouldContinue: true };
  }

  if (result.ok) {
    if (slug && !next.completedSlugs.includes(slug)) {
      next.completedSlugs = [...next.completedSlugs, slug];
    }
  } else if (slug && !next.failedSlugs.includes(slug)) {
    next.failedSlugs = [...next.failedSlugs, slug];
  }

  const nextIndex = job.competitionIndex + 1;
  if (nextIndex >= slugs.length) {
    next.status = next.failedSlugs.length > 0 && next.completedSlugs.length === 0 ? "failed" : "done";
    next.phase = "finalize";
    next.competitionIndex = Math.max(0, slugs.length - 1);
    return { job: next, shouldContinue: false };
  }

  next.competitionIndex = nextIndex;
  next.phase = "insights";
  next.insightsOffset = 0;
  next.insightsSnap = Math.floor(now.getTime() / 1000);
  next.status = "running";
  return { job: next, shouldContinue: true };
}
