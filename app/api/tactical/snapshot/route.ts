import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getOrRefreshSnapshot } from "@/lib/tactical-snapshots";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fixtureId = url.searchParams.get("fixtureId") ?? "auto-live";
  const refresh = url.searchParams.get("refresh") === "1";

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snapshot = await getOrRefreshSnapshot({
    organizationId: organization.organizationId,
    fixtureId,
    forceRefresh: organization.role === "admin" && refresh,
    allowProviderRefresh: organization.role === "admin"
  });

  return NextResponse.json({
    fixtureId,
    metrics: snapshot?.metrics ?? [],
    updatedAt: snapshot?.updated_at ?? null,
    sourceStatus: snapshot?.source_status ?? "error"
  });
}
