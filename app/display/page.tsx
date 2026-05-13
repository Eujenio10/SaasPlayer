import { DisplayView } from "@/components/display-view";
import { BackToMenu } from "@/components/back-to-menu";
import { requireProtectedSession } from "@/lib/auth/guards";
import { getCachedSerieADisplayProgram } from "@/lib/serie-a-display-program";
import {
  loadDisplayProgramSnapshotForOrganization,
  organizationDbEmptyDisplayProgram
} from "@/lib/display-program-org-snapshot-read";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireProtectedSession();

  let program =
    session.organization.role === "admin"
      ? await getCachedSerieADisplayProgram()
      : (await loadDisplayProgramSnapshotForOrganization(session.organization.organizationId)) ??
        organizationDbEmptyDisplayProgram(new Date().toISOString());

  const vetrinaRaw = searchParams.vetrina;
  const vetrinaQuery = vetrinaRaw === "1" || vetrinaRaw === "true";

  return (
    <section className="display-route-root py-4 md:py-6">
      <div className="fixed left-4 top-4 z-[10001]">
        <BackToMenu />
      </div>
      <DisplayView
        initialProgram={program}
        organizationId={session.organization.organizationId}
        vetrinaQuery={vetrinaQuery}
      />
    </section>
  );
}
