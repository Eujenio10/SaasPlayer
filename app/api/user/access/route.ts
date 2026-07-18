import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { buildUserAccessSummary } from "@/lib/auth/user-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const access = await buildUserAccessSummary(user.id, organization.role);
  return NextResponse.json(access, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
