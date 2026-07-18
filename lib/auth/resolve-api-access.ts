import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiSupabaseClient, getApiUser } from "@/lib/auth/get-api-user";
import { getOrganizationContextForUser, type UserAccessRole } from "@/lib/auth/organization";
import {
  resolveMarkingsCatalogOrganizationId,
  resolveProductOrganizationId
} from "@/lib/auth/product-organization";
import { getPublicOrganizationId } from "@/lib/auth/public-org";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export type ApiAccessMode = "authenticated" | "guest";

export interface ApiAccessContext {
  mode: ApiAccessMode;
  organizationId: string;
  userId: string | null;
  role: UserAccessRole | "guest";
  supabase: SupabaseClient;
}

export { getPublicOrganizationId, resolveMarkingsCatalogOrganizationId, resolveProductOrganizationId };

/**
 * Risolve il contesto per le API mobile/catalogo condiviso.
 * Stessa organizationId per guest e account; ruolo e userId governano i permessi.
 */
export async function resolveApiAccessContext(request: Request): Promise<ApiAccessContext | null> {
  const productOrganizationId = await resolveProductOrganizationId();
  if (!productOrganizationId) return null;

  const user = await getApiUser(request);
  if (user) {
    const organization = await getOrganizationContextForUser(user.id);
    return {
      mode: "authenticated",
      organizationId: productOrganizationId,
      userId: user.id,
      role: organization?.role ?? "member",
      supabase: createSupabaseServiceClient()
    };
  }

  return {
    mode: "guest",
    organizationId: productOrganizationId,
    userId: null,
    role: "guest",
    supabase: createSupabaseServiceClient()
  };
}

/** Client Supabase utente (RLS) per operazioni legate all'account, non al catalogo condiviso. */
export function createAuthenticatedApiSupabaseClient(request: Request): SupabaseClient {
  return createApiSupabaseClient(request);
}
