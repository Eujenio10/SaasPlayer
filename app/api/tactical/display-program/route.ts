import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import { getSerieADisplayProgram } from "@/lib/serie-a-display-program";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

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

  const subscription = await getSubscriptionContextForOrganization(organization.organizationId);
  if (organization.role !== "admin" && !subscription?.isOperational) {
    return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
  }

  try {
    const program = await getSerieADisplayProgram(forceRefresh);
    return NextResponse.json(program);
  } catch {
    return NextResponse.json(
      { slides: [], updatedAt: new Date().toISOString(), sourceStatus: "error" as const },
      { status: 500 }
    );
  }
}
