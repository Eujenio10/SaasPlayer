import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { BackToMenu } from "@/components/back-to-menu";
import { KioskSecurityControls } from "@/components/kiosk-security-controls";
import { KioskAnalyticsHub } from "@/components/kiosk-analytics-hub";
import { requireProtectedSession } from "@/lib/auth/guards";
import type { TacticalMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const session = await requireProtectedSession();
  const tacticalData = {
    fixtureId: "kiosk",
    metrics: [] as TacticalMetrics[],
    updatedAt: null as string | null,
    sourceStatus: "kiosk"
  };

  return (
    <section className="space-y-6 py-4 sm:space-y-8 sm:py-6">
      <div className="fixed left-2 top-2 z-[10001] sm:left-4 sm:top-4">
        <BackToMenu />
      </div>
      <header className="space-y-2 pr-2 pt-10 sm:pr-0 sm:pt-0">
        <h1 className="text-2xl font-bold text-cyan-300 sm:text-4xl md:text-5xl">
          Interactive Kiosk Mode
        </h1>
        <p className="text-sm text-slate-300 sm:text-lg">
          Confronto operativo 1 vs 1. Nessun salvataggio locale o storico utente.
        </p>
      </header>
      <DesktopViewportGuard>
        <KioskSecurityControls />
        <KioskAnalyticsHub
          initialMetrics={tacticalData.metrics}
          organizationId={session.organization.organizationId}
          fixtureId={tacticalData.fixtureId}
        />
      </DesktopViewportGuard>
    </section>
  );
}
