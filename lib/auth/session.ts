import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrganizationContextForUser,
  type OrganizationContext
} from "@/lib/auth/organization";
import {
  getSubscriptionContextForOrganization,
  type SubscriptionContext
} from "@/lib/auth/subscription";

export interface SessionContext {
  userId: string;
  email: string | null;
  organization: OrganizationContext | null;
  subscription: SubscriptionContext | null;
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const organization = await getOrganizationContextForUser(user.id);
  const subscription = organization
    ? await getSubscriptionContextForOrganization(organization.organizationId)
    : null;

  return {
    userId: user.id,
    email: user.email ?? null,
    organization,
    subscription
  };
});
