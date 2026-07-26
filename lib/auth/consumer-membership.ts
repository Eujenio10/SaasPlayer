import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { buildUserAccessSummary, type UserAccessSummary } from "@/lib/auth/user-access";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Account consumer mobile/web: garantisce membership nell'org prodotto PitchBrain
 * così /api/user/access e feature Pro IAP funzionano senza invito manuale admin.
 */
export async function ensureConsumerOrganizationMembership(userId: string): Promise<boolean> {
  const existing = await getOrganizationContextForUser(userId);
  if (existing) return true;

  const organizationId = await resolveProductOrganizationId();
  if (!organizationId) {
    console.warn("[consumer-membership] no_product_org", { userId });
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("organization_users").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "member"
  });

  if (error) {
    if (String(error.code) === "23505") return true;
    console.error("[consumer-membership] insert_failed", error.message);
    return false;
  }

  return true;
}

/** Access summary con auto-enroll consumer + abbonamento IAP. */
export async function resolveAuthenticatedUserAccess(userId: string): Promise<UserAccessSummary> {
  await ensureConsumerOrganizationMembership(userId);
  const organization = await getOrganizationContextForUser(userId);
  const role = organization?.role ?? "member";
  return buildUserAccessSummary(userId, role);
}
