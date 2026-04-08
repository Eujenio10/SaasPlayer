import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
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
    <section className="space-y-8 py-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold text-cyan-300 md:text-5xl">
          Kiosk ibrido (Serie A, B, Champions, Europa + altre leghe)
        </h1>
        <p className="text-lg text-slate-300">
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
