import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { allowOnDemandProviderCompute, isConsumerMobileRequest } from "@/lib/entitlements/config";
import { requestHasMatchUnlock, resolveRequestEntitlements } from "@/lib/entitlements/request";
import { refreshMarkingsAndTrendsAfterMatchAnalysis } from "@/lib/catalog-refresh-after-match";
import {
  purgeOrganizationKioskDerivedSnapshots,
  upsertKioskMatchInsightsForOrganization
} from "@/lib/supabase/org-tactical-shared-writes";
import type { TacticalMetrics } from "@/lib/types";
import { localizeTacticalMetrics } from "@/lib/italian-sports-display";
import {
  computeAndPersistOrganizationMatchInsights,
  findOrganizationMatchByEventId
} from "@/lib/organization-match-insights";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const getSchema = z.object({
  eventId: z.coerce.number().int().positive()
});

const putSchema = z.object({
  eventId: z.number().int().positive(),
  insightsSnap: z.number().int().min(0),
  playerDetailLevel: z.enum(["full", "team_only"]),
  metrics: z.array(z.unknown())
});

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const supabase = ctx.supabase;
  const organization = {
    organizationId: ctx.organizationId,
    role: ctx.role === "guest" ? ("member" as const) : ctx.role
  };

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({ eventId: url.searchParams.get("eventId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const eventId = parsed.data.eventId;
  const forceRefresh = url.searchParams.get("refresh") === "1";

  /** `.limit(1)` invece di `.maybeSingle()`: 0 righe non deve diventare 406/PGRST116. */
  const { data: insightRows, error } = await supabase
    .from("kiosk_organization_match_insights")
    .select(
      "event_id,insights_snap,player_detail_level,metrics,updated_at"
    )
    .eq("organization_id", organization.organizationId)
    .eq("event_id", eventId)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const data = Array.isArray(insightRows) ? insightRows[0] : insightRows;

  let metricsRaw = Array.isArray(data?.metrics) ? data.metrics : [];
  let playerDetailLevel = data?.player_detail_level === "team_only" ? "team_only" : "full";
  let insightsSnap = typeof data?.insights_snap === "number" ? data.insights_snap : 0;
  let updatedAt = typeof data?.updated_at === "string" ? data.updated_at : null;

  const entitlements = await resolveRequestEntitlements(ctx, request);
  const matchUnlocked = requestHasMatchUnlock(entitlements, eventId);
  const insightsMissing = !data || metricsRaw.length === 0;

  const canFullAnalysis =
    organization.role === "admin" ||
    entitlements.subscriptionTier === "pro" ||
    matchUnlocked;
  const shouldCompute =
    (allowOnDemandProviderCompute(request) || isConsumerMobileRequest(request)) &&
    ((organization.role === "admin" && (forceRefresh || insightsMissing)) ||
      (canFullAnalysis && insightsMissing));

  if (shouldCompute) {
    const runCompute = async () => {
      const match = await findOrganizationMatchByEventId(organization.organizationId, eventId);
      if (!match) return null;
      const computed = await computeAndPersistOrganizationMatchInsights(
        organization.organizationId,
        match
      );
      if (computed.ok) {
        await refreshMarkingsAndTrendsAfterMatchAnalysis({
          organizationId: organization.organizationId,
          match,
          insightsSnap: Math.floor(Date.now() / 1000)
        }).catch((refreshError) => {
          console.warn(
            "[org-kiosk-match-insights] derived_catalog_refresh_failed:",
            refreshError instanceof Error ? refreshError.message : String(refreshError)
          );
        });
      }
      return computed;
    };

    if (isConsumerMobileRequest(request)) {
      waitUntil(
        runCompute().catch((computeError) => {
          console.warn(
            "[org-kiosk-match-insights] on_demand_compute_failed:",
            computeError instanceof Error ? computeError.message : String(computeError)
          );
        })
      );
    } else {
      try {
        const computed = await runCompute();
        if (computed?.ok) {
          metricsRaw = computed.metrics;
          playerDetailLevel = computed.playerDetailLevel;
          insightsSnap = Math.floor(Date.now() / 1000);
          updatedAt = new Date().toISOString();
        }
      } catch (computeError) {
        console.warn(
          "[org-kiosk-match-insights] on_demand_compute_failed:",
          computeError instanceof Error ? computeError.message : String(computeError)
        );
      }
    }
  }

  const metrics = localizeTacticalMetrics(metricsRaw as TacticalMetrics[]);

  return NextResponse.json({
    eventId,
    insightsSnap,
    playerDetailLevel,
    metrics,
    updatedAt,
    matchUnlocked,
    accessMode: matchUnlocked || entitlements.subscriptionTier === "pro" ? "full" : "preview"
  });
}

export async function PUT(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId, insightsSnap, playerDetailLevel, metrics } = parsed.data;
  const iso = new Date().toISOString();

  const metricsRows = metrics as TacticalMetrics[];

  const persist = await upsertKioskMatchInsightsForOrganization({
    organizationId: productOrganizationId,
    eventId,
    insightsSnap,
    playerDetailLevel,
    metrics: metricsRows,
    updatedAt: iso
  });

  if (!persist.ok) {
    return NextResponse.json(
      { error: "write_failed", message: persist.message ?? "persist_failed" },
      { status: 500 }
    );
  }

  const match = await findOrganizationMatchByEventId(productOrganizationId, eventId);
  if (match) {
    waitUntil(
      refreshMarkingsAndTrendsAfterMatchAnalysis({
        organizationId: productOrganizationId,
        match,
        insightsSnap
      }).catch((error) => {
        console.warn(
          "[org-kiosk-match-insights] derived_catalog_refresh_failed:",
          error instanceof Error ? error.message : String(error)
        );
      })
    );
  }

  return NextResponse.json({ ok: true, eventId, updatedAt: iso });
}

/** Prima di ricaricare i dati: elimina gli snapshot derivati dall’organizzazione (solo admin). */
export async function DELETE(request: Request) {
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

  const purged = await purgeOrganizationKioskDerivedSnapshots(productOrganizationId);

  if (!purged.ok) {
    return NextResponse.json({ error: "purge_failed", details: purged.messages }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    purged: true,
    ...(purged.messages.length ? { warnings: purged.messages } : {})
  });
}
