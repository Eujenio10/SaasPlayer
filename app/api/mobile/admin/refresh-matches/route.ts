import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { runAdminMatchesRefresh } from "@/lib/mobile/admin-refresh-matches";

export const dynamic = "force-dynamic";
/** Hobby Vercel: max 300s. Pro/Enterprise possono alzare fino a 800. */
export const maxDuration = 300;

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

  const result = await runAdminMatchesRefresh(productOrganizationId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "refresh_failed", ...result },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
