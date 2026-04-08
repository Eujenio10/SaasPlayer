import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const org = await getOrganizationContextForUser(user.id);
  if (!org || org.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.rpc("apply_retention_policies", {
    target_org_id: org.organizationId
  });

  if (error) {
    return NextResponse.json({ error: "retention_failed" }, { status: 500 });
  }

  await service.rpc("log_compliance_event", {
    target_org_id: org.organizationId,
    target_event_type: "retention_applied",
    target_details: {
      actor_user_id: user.id
    }
  });

  return NextResponse.json({ ok: true });
}
