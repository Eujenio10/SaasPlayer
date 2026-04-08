import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { BackToMenu } from "@/components/back-to-menu";
import { KioskSecurityControls } from "@/components/kiosk-security-controls";
import { KioskAnalyticsHub } from "@/components/kiosk-analytics-hub";
import { requireProtectedSession } from "@/lib/auth/guards";
import type { TacticalMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KioskHybridPage() {
  const session = await requireProtectedSession();
  const tacticalData = {
    fixtureId: "kiosk-hybrid",
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
          Kiosk ibrido (Serie A, B, Champions, Europa + altre leghe)
        </h1>
        <p className="text-sm text-slate-300 sm:text-lg">
          Per <strong>Serie A</strong>, <strong>Champions League</strong> e <strong>Europa League</strong>: statistiche
          squadra, analisi giocatori e heatmap. Per <strong>Serie B</strong> e le altre leghe del menu: solo{" "}
          <strong>statistiche di squadra</strong>, per limitare le chiamate API.
        </p>
      </header>
      <DesktopViewportGuard>
        <KioskSecurityControls />
        <KioskAnalyticsHub
          initialMetrics={tacticalData.metrics}
          organizationId={session.organization.organizationId}
          fixtureId={tacticalData.fixtureId}
          playerAnalyticsPolicy="serie_a_players"
          kioskTitle="Kiosk ibrido — Tactical Menu"
          kioskDescription="Giocatori e heatmap con Serie A, Champions o Europa; Serie B e altre leghe solo statistiche squadra."
        />
      </DesktopViewportGuard>
    </section>
  );
}
