import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import { requestHasMatchUnlock, resolveRequestEntitlements } from "@/lib/entitlements/request";
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
import { buildTeamFormSignalsForOrganizationMatch } from "@/lib/team-form-signals";

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

  const { data, error } = await supabase
    .from("kiosk_organization_match_insights")
    .select(
      "event_id,insights_snap,player_detail_level,metrics,updated_at"
    )
    .eq("organization_id", organization.organizationId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  let metricsRaw = Array.isArray(data?.metrics) ? data.metrics : [];
  let playerDetailLevel = data?.player_detail_level === "team_only" ? "team_only" : "full";
  let insightsSnap = typeof data?.insights_snap === "number" ? data.insights_snap : 0;
  let updatedAt = typeof data?.updated_at === "string" ? data.updated_at : null;

  const entitlements = await resolveRequestEntitlements(ctx, request);
  const matchUnlocked = requestHasMatchUnlock(entitlements, eventId);
  const insightsMissing = !data || metricsRaw.length === 0;

  // Admin può sempre ricalcolare; Pro / partita sbloccata se lo snapshot manca.
  const canFullAnalysis =
    organization.role === "admin" ||
    entitlements.subscriptionTier === "pro" ||
    matchUnlocked;
  const shouldCompute =
    (organization.role === "admin" && (forceRefresh || insightsMissing)) ||
    (canFullAnalysis && insightsMissing);

  if (shouldCompute) {
    try {
      const match = await findOrganizationMatchByEventId(organization.organizationId, eventId);
      if (match) {
        const computed = await computeAndPersistOrganizationMatchInsights(
          organization.organizationId,
          match
        );
        if (computed.ok) {
          metricsRaw = computed.metrics;
          playerDetailLevel = computed.playerDetailLevel;
          insightsSnap = Math.floor(Date.now() / 1000);
          updatedAt = new Date().toISOString();
        }
      }
    } catch (computeError) {
      console.warn(
        "[org-kiosk-match-insights] on_demand_compute_failed:",
        computeError instanceof Error ? computeError.message : String(computeError)
      );
    }
  }

  const metrics = localizeTacticalMetrics(metricsRaw as TacticalMetrics[]);

  const allowProviderFetch = canFullAnalysis;
  let teamFormSignals = null;
  try {
    teamFormSignals = await buildTeamFormSignalsForOrganizationMatch({
      supabase,
      organizationId: organization.organizationId,
      eventId,
      metrics,
      forceRefresh: organization.role === "admin" && forceRefresh,
      allowProviderFetch
    });
  } catch (signalsError) {
    console.warn(
      "[org-kiosk-match-insights] team_form_signals_failed:",
      signalsError instanceof Error ? signalsError.message : String(signalsError)
    );
  }

  return NextResponse.json({
    eventId,
    insightsSnap,
    playerDetailLevel,
    metrics,
    teamFormSignals,
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
