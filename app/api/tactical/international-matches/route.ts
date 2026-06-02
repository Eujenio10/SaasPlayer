import { NextResponse } from "next/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import { upsertInternationalMatchesMenuSnapshotForOrganization } from "@/lib/supabase/org-tactical-shared-writes";
import { fetchUpcomingInternationalTournamentMatches } from "@/services/sportapi";

/**
 * Solo admin: aggiorna il menù condiviso Coppa del Mondo FIFA maschile (senior; nessun autosync).
 * Pro/Member leggono la copia dalla tabella tramite GET `/api/tactical/matches` (merge lato server).
 */
export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const raw = await fetchUpcomingInternationalTournamentMatches();
    const future = filterMatchesKickoffInFuture(raw);
    const persist = await upsertInternationalMatchesMenuSnapshotForOrganization({
      organizationId: organization.organizationId,
      matches: future
    });

    if (!persist.ok) {
      console.error("[international-matches] persist_failed:", persist.message ?? "(no detail)");
      return NextResponse.json(
        { error: "persist_failed", message: persist.message ?? "" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      savedCount: future.length,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "intl_refresh_unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
