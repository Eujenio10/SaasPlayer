import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { runAdminMatchesRefresh } from "@/lib/mobile/admin-refresh-matches";

export const dynamic = "force-dynamic";
/** Tempo massimo Vercel Pro: più headroom per prefetch completo Top 5. */
export const maxDuration = 800;

/**
 * Admin (web kiosk + app mobile): menu Top 5 + Mondiali, snapshot organizzazione e prefetch insight.
 */
export async function POST(request: Request) {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "refresh_failed";
    console.error("[admin-refresh-matches] unhandled:", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
