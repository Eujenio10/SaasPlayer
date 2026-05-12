import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { BackToMenu } from "@/components/back-to-menu";
import { KioskAnalyticsHub } from "@/components/kiosk-analytics-hub";
import { requireProtectedSession } from "@/lib/auth/guards";
import { buildUserAccessSummary } from "@/lib/auth/user-access";
import type { TacticalMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const session = await requireProtectedSession();
  const userAccess = await buildUserAccessSummary(session.userId, session.organization.role);
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
      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-400/16 via-white/[0.055] to-fuchsia-400/14 p-5 shadow-[0_18px_60px_rgba(8,13,28,0.28)] backdrop-blur pr-2 pt-10 sm:p-7 sm:pr-7 sm:pt-7">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Match insights</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Analisi giocatori
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-lg">
            Scontri in campo, rischio falli e heatmap in una dashboard semplice da consultare.
          </p>
        </div>
      </header>
      <DesktopViewportGuard>
        <KioskAnalyticsHub
          initialMetrics={tacticalData.metrics}
          organizationId={session.organization.organizationId}
          fixtureId={tacticalData.fixtureId}
          userAccess={userAccess}
        />
      </DesktopViewportGuard>
    </section>
  );
}
