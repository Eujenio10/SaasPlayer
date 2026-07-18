import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { regenerateDifficultMarkingsSnapshotForOrganization } from "@/lib/difficult-markings/snapshot";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UpcomingMatchItem } from "@/services/sportapi";

export const dynamic = "force-dynamic";

async function loadOrganizationMenuMatches(organizationId: string): Promise<UpcomingMatchItem[]> {
  const sb = createSupabaseServiceClient();
  const { data: domestic } = await sb
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { data: intl } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return [
    ...(Array.isArray(domestic?.matches) ? (domestic.matches as UpcomingMatchItem[]) : []),
    ...(Array.isArray(intl?.matches) ? (intl.matches as UpcomingMatchItem[]) : [])
  ];
}

/** Rigenerazione amministrativa snapshot Marcature difficili (no FootApi extra). */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const matches = await loadOrganizationMenuMatches(organization.organizationId);
  const insightsSnap = Math.floor(Date.now() / 1000);
  const result = await regenerateDifficultMarkingsSnapshotForOrganization({
    organizationId: organization.organizationId,
    matches,
    insightsSnap
  });

  if (!result.ok) {
    return NextResponse.json({ error: "generate_failed", message: result.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    insightsSnap,
    rounds: result.snapshot?.rounds.length ?? 0,
    matchups: Object.keys(result.snapshot?.matchupIndex ?? {}).length,
    updatedAt: result.snapshot?.updatedAt ?? null
  });
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const eventId = Number(url.searchParams.get("eventId"));
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 });
  }

  const match = await findOrganizationMatchByEventId(organization.organizationId, eventId);
  if (!match) {
    return NextResponse.json({ error: "match_not_in_menu" }, { status: 404 });
  }

  const matches = await loadOrganizationMenuMatches(organization.organizationId);
  const insightsSnap = Math.floor(Date.now() / 1000);
  const result = await regenerateDifficultMarkingsSnapshotForOrganization({
    organizationId: organization.organizationId,
    matches,
    insightsSnap
  });

  if (!result.ok) {
    return NextResponse.json({ error: "generate_failed", message: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId, updatedAt: result.snapshot?.updatedAt ?? null });
}
