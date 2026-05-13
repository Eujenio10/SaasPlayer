import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import type { TacticalMetrics } from "@/lib/types";

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

  const url = new URL(request.url);
  const parsed = getSchema.safeParse({ eventId: url.searchParams.get("eventId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const eventId = parsed.data.eventId;

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

  if (!data) {
    return NextResponse.json({
      eventId,
      insightsSnap: 0,
      playerDetailLevel: "full",
      metrics: [] as TacticalMetrics[],
      updatedAt: null as string | null
    });
  }

  const metricsRaw = Array.isArray(data.metrics) ? data.metrics : [];
  const playerDetailLevel = data.player_detail_level === "team_only" ? "team_only" : "full";

  return NextResponse.json({
    eventId: data.event_id,
    insightsSnap: typeof data.insights_snap === "number" ? data.insights_snap : 0,
    playerDetailLevel,
    metrics: metricsRaw as TacticalMetrics[],
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null
  });
}

export async function PUT(request: Request) {
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

  const { error } = await supabase.from("kiosk_organization_match_insights").upsert(
    {
      organization_id: organization.organizationId,
      event_id: eventId,
      insights_snap: insightsSnap,
      player_detail_level: playerDetailLevel,
      metrics: metrics as unknown as Record<string, unknown>[],
      updated_at: iso
    },
    { onConflict: "organization_id,event_id" }
  );

  if (error) {
    return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId, updatedAt: iso });
}
