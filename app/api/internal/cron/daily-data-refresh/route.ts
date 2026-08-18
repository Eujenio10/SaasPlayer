import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { authorizeCronRequest } from "@/lib/data-refresh/cron-auth";
import {
  continueMorningRefreshChain,
  isMorningRefreshContinuation,
  runMorningRefreshTick
} from "@/lib/data-refresh/run-morning-refresh";

export const dynamic = "force-dynamic";
/** Hobby/Pro Vercel: sotto i 300s per tick; il giro completo si concatena da solo. */
export const maxDuration = 300;

function enqueueContinuation(request: Request, shouldContinue: boolean) {
  if (!shouldContinue) return;

  waitUntil(
    continueMorningRefreshChain(request).catch((error) => {
      console.warn(
        "[cron/daily-data-refresh] chain_error:",
        error instanceof Error ? error.message : String(error)
      );
    })
  );
}

/**
 * Giro mattutino (05:00 Europe/Rome):
 * 1) Vercel cron alle 03:00 UTC (05:00 in estate) e 04:00 UTC (05:00 in inverno) avvia il job
 * 2) Ogni invocazione fa una fetta (menu, o un batch insight, o finalize di un campionato)
 * 3) Appena finisce, la funzione richiama se stessa e passa al campionato successivo
 *
 * Sito e app leggono gli stessi snapshot: non serve uno scheduler sul client.
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const productOrganizationId = await resolveProductOrganizationId();
  if (!productOrganizationId) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  try {
    const tick = await runMorningRefreshTick({
      organizationId: productOrganizationId,
      isContinuation: isMorningRefreshContinuation(request)
    });

    enqueueContinuation(request, tick.shouldContinue);

    return NextResponse.json({
      trigger: "scheduled_cron",
      ...(tick.result ?? {}),
      ok: tick.ok,
      skipped: tick.skipped ?? false,
      reason: tick.reason,
      shouldContinue: tick.shouldContinue,
      competitionSlug: tick.competitionSlug ?? "menu",
      phase: tick.phase ?? tick.job?.phase,
      job: tick.job,
      error: tick.ok ? undefined : tick.result?.error
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh_failed";
    console.error("[cron/daily-data-refresh] unhandled:", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
