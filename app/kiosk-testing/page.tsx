import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { KioskAnalyticsHub } from "@/components/kiosk-analytics-hub";
import { requireProtectedSession } from "@/lib/auth/guards";
import { buildUserAccessSummary } from "@/lib/auth/user-access";

export const dynamic = "force-dynamic";

export default async function KioskTestingPage() {
  const session = await requireProtectedSession();
  const userAccess = await buildUserAccessSummary(session.userId, session.organization.role);

  return (
    <section className="space-y-6 py-4 sm:space-y-8 sm:py-6">
      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-400/16 via-white/[0.055] to-fuchsia-400/14 p-5 shadow-[0_18px_60px_rgba(8,13,28,0.28)] backdrop-blur sm:p-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Ambiente test</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Match demo
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-lg">
          Vista dedicata per verificare rapidamente mapping, qualità dati e resa grafica.
        </p>
      </header>
      <DesktopViewportGuard>
        <KioskAnalyticsHub
          initialMetrics={[]}
          organizationId={session.organization.organizationId}
          fixtureId="kiosk-testing"
          userAccess={userAccess}
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
