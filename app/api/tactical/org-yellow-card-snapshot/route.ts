import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";

const putSchema = z.object({
  insightsSnap: z.number().int().min(0).optional(),
  matches: z.array(z.unknown()),
  rows: z.array(z.unknown())
});

export async function GET() {
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

  const { data, error } = await supabase
    .from("organization_yellow_card_snapshot")
    .select("insights_snap,snapshot,updated_at")
    .eq("organization_id", organization.organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      insightsSnap: 0,
      matches: [],
      rows: [],
      updatedAt: null as string | null
    });
  }

  const snap = data.snapshot as { matches?: unknown[]; rows?: unknown[] };
  const matches = Array.isArray(snap?.matches) ? snap.matches : [];
  const rows = Array.isArray(snap?.rows) ? snap.rows : [];

  return NextResponse.json({
    insightsSnap: typeof data.insights_snap === "number" ? data.insights_snap : 0,
    matches,
    rows,
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

  const insightsSnap = typeof parsed.data.insightsSnap === "number" ? parsed.data.insightsSnap : 0;

  const iso = new Date().toISOString();
  const { error } = await supabase.from("organization_yellow_card_snapshot").upsert(
    {
      organization_id: organization.organizationId,
      insights_snap: insightsSnap,
      snapshot: { matches: parsed.data.matches, rows: parsed.data.rows },
      updated_at: iso
    },
    { onConflict: "organization_id" }
  );

  if (error) {
    return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt: iso });
}
