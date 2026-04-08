import { AdminSubscriptionPanel } from "@/components/admin-subscription-panel";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminOrganizationsForUser } from "@/lib/auth/organization";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage({
  searchParams
}: {
  searchParams: { organizationId?: string };
}) {
  const session = await requireAdminSession();
  const service = createSupabaseServiceClient();
  const adminOrganizations = await getAdminOrganizationsForUser(session.userId);

  if (!adminOrganizations.length) {
    return null;
  }

  const selectedOrganizationId = adminOrganizations.some(
    (org) => org.organizationId === searchParams.organizationId
  )
    ? (searchParams.organizationId as string)
    : adminOrganizations[0].organizationId;

  const { data: subscription } = await service
    .from("subscriptions")
    .select("status, current_period_end, plan")
    .eq("organization_id", selectedOrganizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <section className="space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-cyan-300">Admin Abbonamenti</h1>
        <p className="text-slate-300">
          Gestione manuale attivazione, rinnovo e sospensione via bonifico.
        </p>
      </header>

      <AdminSubscriptionPanel
        status={subscription?.status ?? null}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        plan={subscription?.plan ?? null}
        organizations={adminOrganizations}
        selectedOrganizationId={selectedOrganizationId}
      />
    </section>
  );
}
