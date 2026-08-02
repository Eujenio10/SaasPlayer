import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import {
  runAdminMatchesRefresh,
  type AdminRefreshPhase
} from "@/lib/mobile/admin-refresh-matches";

export const dynamic = "force-dynamic";
/** Hobby Vercel: max 300s. */
export const maxDuration = 300;

function parsePhase(value: unknown): AdminRefreshPhase | undefined {
  if (value === "start" || value === "insights" || value === "finalize") return value;
  return undefined;
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization || organization.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const productOrganizationId = await resolveProductOrganizationId();
  if (!productOrganizationId) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const phase = parsePhase(body.phase) ?? "start";
  const insightsOffset =
    typeof body.insightsOffset === "number" && Number.isFinite(body.insightsOffset)
      ? Math.max(0, Math.floor(body.insightsOffset))
      : 0;
  const insightsSnap =
    typeof body.insightsSnap === "number" && Number.isFinite(body.insightsSnap)
      ? Math.floor(body.insightsSnap)
      : undefined;
  const insightsBatchSize =
    typeof body.insightsBatchSize === "number" && Number.isFinite(body.insightsBatchSize)
      ? Math.max(1, Math.floor(body.insightsBatchSize))
      : undefined;

  const result = await runAdminMatchesRefresh(productOrganizationId, {
    trigger: "admin_manual",
    phase,
    insightsOffset,
    insightsSnap,
    insightsBatchSize
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "refresh_failed", ...result },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
