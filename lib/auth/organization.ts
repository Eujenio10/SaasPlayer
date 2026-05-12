import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type UserAccessRole = "admin" | "pro" | "member";
type DatabaseAccessRole = UserAccessRole | "viewer";

export interface OrganizationContext {
  organizationId: string;
  organizationName: string;
  allowedIp: string | null;
  allowedIpRanges: string[];
  role: UserAccessRole;
}

export interface AdminOrganizationOption {
  organizationId: string;
  organizationName: string;
}

function normalizeAccessRole(role: string | null | undefined): UserAccessRole {
  if (role === "admin" || role === "pro" || role === "member") return role;
  // Compatibilita con il vecchio ruolo viewer: equivale ai membri del canale.
  if (role === "viewer") return "member";
  return "member";
}

export async function getOrganizationContextForUser(
  userId: string
): Promise<OrganizationContext | null> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("organization_users")
    .select("organization_id, role, organizations(name, allowed_ip, allowed_ip_ranges)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;

  if (!organization?.name) {
    return null;
  }

  return {
    organizationId: data.organization_id,
    organizationName: organization.name,
    allowedIp: organization.allowed_ip ?? null,
    allowedIpRanges: organization.allowed_ip_ranges ?? [],
    role: normalizeAccessRole(data.role as DatabaseAccessRole)
  };
}

export async function getAdminOrganizationsForUser(
  userId: string
): Promise<AdminOrganizationOption[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("organization_users")
    .select("organization_id, organizations(name)")
    .eq("user_id", userId)
    .eq("role", "admin");

  if (error || !data) return [];

  return data
    .map((row) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!org?.name) return null;
      return {
        organizationId: row.organization_id as string,
        organizationName: org.name as string
      };
    })
    .filter((value): value is AdminOrganizationOption => value !== null);
}
