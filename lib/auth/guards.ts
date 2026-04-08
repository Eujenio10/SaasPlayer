import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import type { SessionContext } from "@/lib/auth/session";
import type { OrganizationContext } from "@/lib/auth/organization";
import type { SubscriptionContext } from "@/lib/auth/subscription";

type ProtectedSessionContext = SessionContext & {
  organization: OrganizationContext;
  subscription: SubscriptionContext;
};

type OrganizationSessionContext = SessionContext & {
  organization: OrganizationContext;
};

export async function requireOrganizationSession(): Promise<OrganizationSessionContext> {
  const session = await getSessionContext();

  if (!session) {
    redirect("/login");
  }

  if (!session.organization) {
    redirect("/forbidden");
  }

  return session as OrganizationSessionContext;
}

export async function requireAdminSession(): Promise<OrganizationSessionContext> {
  const session = await requireOrganizationSession();

  if (session.organization.role !== "admin") {
    redirect("/forbidden");
  }

  return session;
}

export async function requireProtectedSession(): Promise<ProtectedSessionContext> {
  const session = await requireOrganizationSession();

  if (session.organization.role !== "admin" && !session.subscription?.isOperational) {
    redirect("/suspended");
  }

  return session as ProtectedSessionContext;
}
