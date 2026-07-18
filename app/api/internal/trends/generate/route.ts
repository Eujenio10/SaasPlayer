import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { regenerateTrendsSnapshotForOrganization } from "@/lib/trends/snapshot";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UpcomingMatchItem } from "@/services/sportapi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const insightsSnap = Date.now();
  const sb = createSupabaseServiceClient();
  const { data: menuRow } = await sb
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organization.organizationId)
    .maybeSingle();

  const { data: intlRow } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organization.organizationId)
    .maybeSingle();

  const domestic = Array.isArray(menuRow?.matches) ? (menuRow.matches as UpcomingMatchItem[]) : [];
  const international = Array.isArray(intlRow?.matches) ? (intlRow.matches as UpcomingMatchItem[]) : [];
  const matches = [...domestic, ...international];

  const result = await regenerateTrendsSnapshotForOrganization({
    organizationId: organization.organizationId,
    matches,
    insightsSnap
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message ?? "generate_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    trends: Object.keys(result.snapshot?.trendIndex ?? {}).length,
    rounds: result.snapshot?.rounds.length ?? 0
  });
}
