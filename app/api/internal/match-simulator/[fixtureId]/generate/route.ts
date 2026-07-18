import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import { generateAndCacheSimulation } from "@/lib/match-simulator/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ fixtureId: string }> }
) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { fixtureId } = await context.params;
  const eventId = Number(fixtureId);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "invalid_fixture" }, { status: 400 });
  }

  const match = await findOrganizationMatchByEventId(organization.organizationId, eventId);
  if (!match) {
    return NextResponse.json({ error: "fixture_not_found" }, { status: 404 });
  }

  const result = await generateAndCacheSimulation({
    organizationId: organization.organizationId,
    match,
    insightsSnap: Date.now()
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message ?? "generate_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fixtureId,
    reliabilityScore: result.entry?.reliabilityScore,
    modelVersion: result.entry?.result.modelVersion
  });
}
