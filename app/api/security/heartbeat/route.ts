import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";

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

  const body = (await request.json().catch(() => ({}))) as {
    eventType?: string;
    path?: string;
    visibility?: string;
    fullscreen?: boolean;
  };

  const eventType = body.eventType ?? "runtime_heartbeat";
  const service = createSupabaseServiceClient();
  await service.rpc("log_compliance_event", {
    target_org_id: organization.organizationId,
    target_event_type: eventType,
    target_details: {
      user_id: user.id,
      path: body.path ?? null,
      visibility: body.visibility ?? null,
      fullscreen: body.fullscreen ?? null
    }
  });

  return NextResponse.json({ ok: true });
}
