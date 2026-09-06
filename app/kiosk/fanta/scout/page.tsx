import { BackToMenu } from "@/components/back-to-menu";
import { FantaScoutPage } from "@/components/fanta/fanta-scout-page";
import { requireProtectedSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function KioskFantaScoutPage() {
  await requireProtectedSession();
  return (
    <>
      <div className="fixed left-2 top-2 z-[10001] sm:left-4 sm:top-4">
        <BackToMenu />
      </div>
      <FantaScoutPage />
    </>
  );
}
