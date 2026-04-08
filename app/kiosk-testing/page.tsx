import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { KioskSecurityControls } from "@/components/kiosk-security-controls";
import { KioskAnalyticsHub } from "@/components/kiosk-analytics-hub";
import { requireProtectedSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function KioskTestingPage() {
  const session = await requireProtectedSession();

  return (
    <section className="space-y-6 py-4 sm:space-y-8 sm:py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-cyan-300 sm:text-4xl md:text-5xl">
          Kiosk Testing (PSG vs Tolosa)
        </h1>
        <p className="text-sm text-slate-300 sm:text-lg">
          Ambiente di test dedicato a una sola partita per verificare mapping e qualità dati con consumo API minimo.
        </p>
      </header>
      <DesktopViewportGuard>
        <KioskSecurityControls />
        <KioskAnalyticsHub
          initialMetrics={[]}
          organizationId={session.organization.organizationId}
          fixtureId="kiosk-testing"
          testingMatch={{
            home: "Paris Saint-Germain",
            away: "Toulouse",
            competition: "ligue-1"
          }}
          presetMatch={{
            eventId: 14167955,
            competitionSlug: "ligue-1",
            competitionName: "Ligue 1",
            startTimestamp: 0,
            homeTeam: { id: 1644, name: "Paris Saint-Germain" },
            awayTeam: { id: 1681, name: "Toulouse" }
          }}
        />
      </DesktopViewportGuard>
    </section>
  );
}
