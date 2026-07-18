import { BackToMenu } from "@/components/back-to-menu";
import { DifficultMarkingDetailPage } from "@/components/difficult-markings/difficult-marking-detail-page";
import { requireProtectedSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function MarcaturaDifficileDetailPage({
  params
}: {
  params: Promise<{ matchupId: string }>;
}) {
  await requireProtectedSession();
  const { matchupId } = await params;

  return (
    <>
      <div className="fixed left-2 top-2 z-[10001] sm:left-4 sm:top-4">
        <BackToMenu />
      </div>
      <DifficultMarkingDetailPage matchupId={decodeURIComponent(matchupId)} />
    </>
  );
}
