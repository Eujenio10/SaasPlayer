import { BackToMenu } from "@/components/back-to-menu";
import { FantaTrendsPage } from "@/components/fanta/fanta-trends-page";
import { requireProtectedSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function KioskFantaTrendsPage() {
  await requireProtectedSession();
  return (
    <>
      <div className="fixed left-2 top-2 z-[10001] sm:left-4 sm:top-4">
        <BackToMenu />
      </div>
      <FantaTrendsPage />
    </>
  );
}
