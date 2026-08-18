import {
  isAfterOrAtDailyRefreshStart,
  isBeforeMorningRefreshHardStop,
  romeDateKeyNow
} from "@/lib/data-refresh/schedule";
import {
  advanceMorningJobAfterTick,
  createMorningRefreshJob,
  currentMorningCompetitionSlug,
  type MorningRefreshJob
} from "@/lib/data-refresh/morning-job";
import { getMorningRefreshJob, recordDataRefreshCompletion, saveMorningRefreshJob } from "@/lib/data-refresh/state";
import { runAdminMatchesRefresh } from "@/lib/mobile/admin-refresh-matches";

export interface MorningRefreshTickResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  shouldContinue: boolean;
  job: MorningRefreshJob | null;
  competitionSlug?: string;
  phase?: MorningRefreshJob["phase"];
  result?: Awaited<ReturnType<typeof runAdminMatchesRefresh>>;
}

export async function runMorningRefreshTick(params: {
  organizationId: string;
  isContinuation?: boolean;
  now?: Date;
}): Promise<MorningRefreshTickResult> {
  const now = params.now ?? new Date();
  const todayKey = romeDateKeyNow(now);
  const existing = await getMorningRefreshJob(params.organizationId);

  let job = existing?.dateKey === todayKey ? existing : null;

  if (job?.status === "done") {
    return { ok: true, skipped: true, reason: "already_completed_today", shouldContinue: false, job };
  }

  if (job?.status === "failed") {
    return { ok: false, skipped: true, reason: "failed_today", shouldContinue: false, job };
  }

  if (!job) {
    const canStart = isAfterOrAtDailyRefreshStart(now) && isBeforeMorningRefreshHardStop(now);
    if (!canStart) {
      return {
        ok: true,
        skipped: true,
        reason: "outside_refresh_window",
        shouldContinue: false,
        job: existing
      };
    }
    job = createMorningRefreshJob(todayKey, now);
    await saveMorningRefreshJob({ organizationId: params.organizationId, job });
  }

  const competitionSlug = currentMorningCompetitionSlug(job);
  const result = await runAdminMatchesRefresh(params.organizationId, {
    trigger: "scheduled_cron",
    phase: job.phase,
    competitionSlug: job.phase === "start" ? undefined : competitionSlug,
    insightsOffset: job.insightsOffset,
    insightsSnap: job.insightsSnap || undefined,
    skipCompletionRecord: true
  });

  const advanced = advanceMorningJobAfterTick(job, result, now);

  await saveMorningRefreshJob({
    organizationId: params.organizationId,
    job: advanced.job,
    trigger: "scheduled_cron"
  });

  if (job.phase === "finalize") {
    await recordDataRefreshCompletion({
      organizationId: params.organizationId,
      trigger: "scheduled_cron",
      ok: result.ok
    });
  }

  console.info("[morning-refresh] tick", {
    dateKey: advanced.job.dateKey,
    phase: job.phase,
    nextPhase: advanced.job.phase,
    competitionSlug: competitionSlug ?? "menu",
    status: advanced.job.status,
    shouldContinue: advanced.shouldContinue,
    tickCount: advanced.job.tickCount,
    continuation: Boolean(params.isContinuation),
    ok: result.ok,
    insightsOffset: result.nextInsightsOffset,
    insightsTotal: result.insightsTotal
  });

  return {
    ok: result.ok,
    shouldContinue: advanced.shouldContinue,
    job: advanced.job,
    competitionSlug,
    phase: job.phase,
    result
  };
}

export function isMorningRefreshContinuation(request: Request): boolean {
  return request.headers.get("x-morning-refresh-continue") === "1";
}

export function resolveMorningRefreshSelfUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return `${fromEnv}/api/internal/cron/daily-data-refresh`;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}/api/internal/cron/daily-data-refresh`;
  return new URL("/api/internal/cron/daily-data-refresh", request.url).toString();
}

export async function continueMorningRefreshChain(request: Request): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const url = resolveMorningRefreshSelfUrl(request);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: secret ? `Bearer ${secret}` : "",
      "x-morning-refresh-continue": "1"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("[morning-refresh] chain_failed", response.status, body.slice(0, 400));
  }
}
