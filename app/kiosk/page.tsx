import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
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
    <section className="space-y-8 py-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-cyan-300 md:text-5xl">
          Interactive Kiosk Mode
        </h1>
        <p className="text-lg text-slate-300">
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
