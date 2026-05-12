import { BackToMenu } from "@/components/back-to-menu";
import { YellowCardRiskPage } from "@/components/yellow-card-risk-page";
import { requireProtectedSession } from "@/lib/auth/guards";
import { buildUserAccessSummary } from "@/lib/auth/user-access";

export const dynamic = "force-dynamic";

export default async function AllarmeAmmonizioniPage() {
  const session = await requireProtectedSession();
  const userAccess = await buildUserAccessSummary(session.userId, session.organization.role);

  return (
    <>
      <div className="fixed left-2 top-2 z-[10001] sm:left-4 sm:top-4">
        <BackToMenu />
      </div>
      <YellowCardRiskPage userAccess={userAccess} />
    </>
  );
}
