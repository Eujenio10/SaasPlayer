import { NextResponse } from "next/server";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { authorizeCronRequest } from "@/lib/data-refresh/cron-auth";
import { runPrematchRefreshTick } from "@/lib/data-refresh/run-prematch-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rinfresco pre-partita (Europe/Rome), pensato per un ping ogni 10 minuti.
 *
 * A ogni chiamata legge il menu già salvato a DB, prende le partite con calcio
 * d'inizio tra 35 e 5 minuti e ne rigenera simulazione e marcature con le
 * formazioni ufficiali. Se non c'è nulla in finestra esce subito senza costi API.
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
    const tick = await runPrematchRefreshTick({ organizationId: productOrganizationId });
    return NextResponse.json({ trigger: "prematch_cron", ...tick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "prematch_refresh_failed";
    console.error("[cron/prematch-refresh] unhandled:", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
