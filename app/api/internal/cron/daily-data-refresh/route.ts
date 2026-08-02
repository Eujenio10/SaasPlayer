import { NextResponse } from "next/server";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { authorizeCronRequest } from "@/lib/data-refresh/cron-auth";
import { isWithinDailyRefreshWindow, romeDateKeyFromIso, romeDateKeyNow } from "@/lib/data-refresh/schedule";
import { getLastDataRefreshAt } from "@/lib/data-refresh/state";
import { runAdminMatchesRefresh } from "@/lib/mobile/admin-refresh-matches";

export const dynamic = "force-dynamic";
/** Hobby Vercel: max 300s. */
export const maxDuration = 300;

/**
 * Cron giornaliero (08:00 Europe/Rome via vercel.json): aggiorna menu, insight e snapshot derivati.
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const productOrganizationId = await resolveProductOrganizationId();
  if (!productOrganizationId) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  if (!isWithinDailyRefreshWindow()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "outside_refresh_window" });
  }

  const lastRefreshAt = await getLastDataRefreshAt(productOrganizationId);
  if (lastRefreshAt && romeDateKeyFromIso(lastRefreshAt) === romeDateKeyNow()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_refreshed_today" });
  }

  try {
    const result = await runAdminMatchesRefresh(productOrganizationId, {
      trigger: "scheduled_cron"
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "refresh_failed", ...result },
        { status: 503 }
      );
    }

    return NextResponse.json({ trigger: "scheduled_cron", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh_failed";
    console.error("[cron/daily-data-refresh] unhandled:", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
