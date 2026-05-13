import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { appliesWeeklyMatchQuota, ensureMemberCanAnalyzeMatch } from "@/lib/auth/user-access";

const bodySchema = z.object({
  eventId: z.number().int().positive()
});

export async function POST(request: Request) {
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

  if (!appliesWeeklyMatchQuota(organization.role)) {
    return NextResponse.json({ ok: true, quotaSkipped: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureMemberCanAnalyzeMatch(user.id, parsed.data.eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "member_weekly_match_limit_reached") {
      return NextResponse.json({ error: "weekly_match_limit" }, { status: 403 });
    }
    console.error("[member-match-week-consume]", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
