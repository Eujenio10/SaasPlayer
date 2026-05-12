"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Gauge,
  Home,
  Menu,
  Settings,
  ShieldAlert,
  Swords,
  TriangleAlert,
  UserRound,
  X
} from "lucide-react";
import type { UpcomingMatchItem } from "@/services/sportapi";
import { dedupeMatchesByEventId } from "@/lib/tactical-matches-filters";
import {
  buildDashboardLiveStats,
  type DashboardLiveStats,
  type DashboardMonitorCard
} from "@/lib/dashboard-home-stats";
import {
  KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT,
  KIOSK_INSIGHTS_LOCAL_WRITE_EVENT,
  YELLOW_CARD_SNAPSHOT_UPDATED_EVENT
} from "@/lib/kiosk-persisted-insights";
import { ProfileDropdown } from "@/components/profile/profile-dropdown";

interface DashboardHomePageProps {
  email?: string | null;
}

const menuItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Scontri in campo", href: "/kiosk", icon: Swords },
  { label: "Rischio falli", href: "/kiosk/hybrid", icon: ShieldAlert },
  { label: "Allarme ammonizioni", href: "/kiosk/allarme-ammonizioni", icon: TriangleAlert },
  { label: "Partite", href: "/kiosk", icon: CalendarDays },
  { label: "Statistiche", href: "/kiosk/hybrid", icon: Gauge },
  { label: "Il mio profilo", href: "/profilo", icon: UserRound },
  { label: "Impostazioni", href: "#settings", icon: Settings }
];

const featureCards = [
  {
    title: "Scontri in campo",
    description: "Analizza tutti i matchup difensore vs attaccante.",
    href: "/kiosk",
    icon: Swords,
    color: "text-cyan-300",
    glow: "shadow-[0_0_28px_rgba(56,189,248,0.14)]"
  },
  {
    title: "Rischio falli",
    description: "Scopri i giocatori più fallosi e i loro dati chiave.",
    href: "/kiosk/hybrid",
    icon: ShieldAlert,
    color: "text-amber-300",
    glow: "shadow-[0_0_28px_rgba(250,204,21,0.12)]"
  },
  {
    title: "Allarme ammonizioni",
    description: "Individua i giocatori a maggior rischio cartellino.",
    href: "/kiosk/allarme-ammonizioni",
    icon: TriangleAlert,
    color: "text-rose-300",
    glow: "shadow-[0_0_28px_rgba(244,63,94,0.12)]"
  }
];

function formatDashboardInsightLabel(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return "—";
  }
}

function isInsightVeryFresh(iso: string | null, windowMs = 20 * 60 * 1000): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < windowMs;
}

function profileMenuFromEmail(email: string | null | undefined): { initials: string; displayNameShort: string } {
  const raw = (email ?? "").trim();
  if (!raw) {
    return { initials: "U", displayNameShort: "Utente" };
  }
  const local = raw.split("@")[0] ?? raw;
  const parts = local.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
      : (local.slice(0, 2) || "U").toUpperCase();
  const displayNameShort = parts.length
    ? parts.map((p) => (p[0] ? p[0]!.toUpperCase() + p.slice(1).toLowerCase() : "")).join(" ").slice(0, 28) ||
      local
    : local;
  return { initials, displayNameShort };
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-[rgba(120,170,255,0.12)] bg-[rgba(8,16,32,0.92)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:shadow-[0_18px_55px_rgba(14,165,233,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}

function TeamBadge({ code, color }: { code: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-100">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {code}
    </span>
  );
}

function GlowButton({
  href,
  children,
  variant = "primary"
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  const classes =
    variant === "primary"
      ? "border-cyan-300/30 bg-cyan-500 px-6 py-3 text-white shadow-[0_16px_42px_rgba(14,165,233,0.22)] hover:bg-cyan-400"
      : "border-cyan-300/18 bg-white/[0.035] px-6 py-3 text-slate-200 hover:border-cyan-300/35 hover:bg-cyan-400/8";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-2xl border text-sm font-black transition duration-300 ${classes}`}
    >
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
        <span className="text-xl font-black text-cyan-200">ID</span>
      </div>
      <div className="leading-none">
        <p className="text-sm font-black uppercase tracking-[0.13em] text-white">Il Dodicesimo</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Analisi Sportiva</p>
      </div>
    </div>
  );
}

function TopBar({ onOpenMenu, email }: { onOpenMenu: () => void; email?: string | null }) {
  const { initials, displayNameShort } = profileMenuFromEmail(email);

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-[rgba(90,140,255,0.15)] bg-[#040B14]/82 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-white/[0.035] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark />
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-emerald-300/18 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-200 sm:inline-flex">
            Accesso attivo
          </span>
          <ProfileDropdown initials={initials} displayNameShort={displayNameShort} />
        </div>
      </div>
    </header>
  );
}

function MobileDrawerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute left-0 top-0 h-full w-[min(86vw,360px)] border-r border-cyan-300/12 bg-[#050B14] p-5 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
            aria-label="Chiudi menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-10 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-cyan-300/18 hover:bg-cyan-400/8 hover:text-white"
              >
                <Icon className="h-5 w-5 text-cyan-300/80" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-10 rounded-3xl border border-cyan-300/12 bg-cyan-400/[0.045] p-5">
          <p className="font-black text-white">IlDodicesimo</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Analisi calcistica premium, semplice da leggere e pronta da usare.</p>
        </div>
      </aside>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto flex max-w-[780px] flex-col items-center px-4 pb-14 pt-16 text-center sm:pb-20 sm:pt-24">
      <p className="mb-5 rounded-full border border-cyan-300/15 bg-cyan-400/8 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
        Tactical Football Intelligence
      </p>
      <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
        Studia i matchup <span className="block text-cyan-300">prima degli altri</span>
      </h1>
      <p className="mt-6 max-w-[750px] text-base leading-8 text-slate-300 sm:text-lg">
        Analizza scontri diretti, falli commessi, falli subiti e rischio ammonizione con dati aggiornati.
      </p>
      <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <GlowButton href="/kiosk">Apri analisi</GlowButton>
        <GlowButton href="/kiosk/hybrid" variant="outline">Partite di oggi</GlowButton>
      </div>
    </section>
  );
}

function FeatureCard({ card }: { card: (typeof featureCards)[number] }) {
  const Icon = card.icon;

  return (
    <Link href={card.href}>
      <CardShell className="h-full p-6">
        <span className={`flex h-13 w-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] ${card.color} ${card.glow}`}>
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="mt-6 text-xl font-black text-white">{card.title}</h2>
        <p className="mt-3 min-h-[52px] text-sm leading-7 text-slate-400">{card.description}</p>
        <p className="mt-6 text-sm font-black text-cyan-300">Apri →</p>
      </CardShell>
    </Link>
  );
}

function FeatureCards() {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((card) => (
          <FeatureCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

function LiveOverview({
  stats,
  matchesLoading
}: {
  stats: DashboardLiveStats;
  matchesLoading: boolean;
}) {
  const insightFresh = isInsightVeryFresh(stats.lastInsightIso);
  const tiles: Array<{
    label: string;
    display: React.ReactNode;
    icon: typeof CalendarDays;
  }> = [
    {
      label: "Partite oggi",
      display: matchesLoading ? "—" : String(stats.matchesTodayCount),
      icon: CalendarDays
    },
    {
      label: "Giocatori analizzati",
      display: String(stats.playersAnalyzedUnique),
      icon: UserRound
    },
    {
      label: "Alert ammonizione",
      display: String(stats.yellowAlertsCount),
      icon: TriangleAlert
    },
    {
      label: "Ultimo aggiornamento",
      display:
        insightFresh && stats.lastInsightIso ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-base font-black text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            LIVE
          </span>
        ) : (
          formatDashboardInsightLabel(stats.lastInsightIso)
        ),
      icon: Activity
    }
  ];

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4">
      <CardShell className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Panoramica live</h2>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">LIVE</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <p className="mt-4 text-3xl font-black text-white">{metric.display}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Partite: calendario future dal menu dati (fuso Europe/Roma). Giocatori e alert: ultimo salvataggio nel browser
          dopo analisi kiosk / Allarme ammonizioni (stessa ondata dell’aggiornamento admin).
        </p>
      </CardShell>
    </section>
  );
}

function MatchCard({ match }: { match: DashboardMonitorCard }) {
  return (
    <CardShell className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{match.competition}</p>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <Clock3 className="h-3.5 w-3.5" />
          {match.time}
        </span>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <TeamBadge code={match.home} color={match.colors[0]} />
        <span className="text-xs font-black text-slate-600">vs</span>
        <TeamBadge code={match.away} color={match.colors[1]} />
      </div>
    </CardShell>
  );
}

function MatchMonitorSection({
  monitorMatches,
  loading,
  error
}: {
  monitorMatches: DashboardMonitorCard[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="mx-auto mt-6 max-w-6xl px-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Partite da monitorare</h2>
        <Link href="/kiosk" className="text-sm font-black text-cyan-300 transition hover:text-cyan-100">
          Vedi tutte →
        </Link>
      </div>
      {error ? (
        <CardShell className="p-6 text-sm text-rose-300">{error}</CardShell>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardShell key={`sk-${i}`} className="h-[120px] animate-pulse bg-white/[0.04]">
              <span className="sr-only">Caricamento partite…</span>
            </CardShell>
          ))}
        </div>
      ) : monitorMatches.length === 0 ? (
        <CardShell className="p-6 text-sm text-slate-400">
          Nessuna partita futura disponibile nel menu: aggiorna più tardi o apri il kiosk per ricaricare il calendario.
        </CardShell>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {monitorMatches.map((match) => (
            <MatchCard key={match.key} match={match} />
          ))}
        </div>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 border-t border-cyan-300/10 px-4 py-8 text-xs text-slate-500">
      <div>
        <p>Tactical Intelligence Hub © 2025 IlDodicesimo</p>
        <p className="mt-1">Piattaforma di analisi sportiva, statistica ed editoriale.</p>
      </div>
    </footer>
  );
}

function HomePage({ email }: DashboardHomePageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [statsRevision, setStatsRevision] = useState(0);
  /** Dopo mount, abilita lettura localStorage (evita mismatch SSR/client). */
  const [browserCacheReady, setBrowserCacheReady] = useState(false);

  useEffect(() => {
    setBrowserCacheReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      setMatchesLoading(true);
      setMatchesError(null);
      try {
        const res = await fetch("/api/tactical/matches", { cache: "no-store" });
        if (!res.ok) throw new Error("matches_unavailable");
        const json = (await res.json()) as { matches?: UpcomingMatchItem[] };
        const raw = Array.isArray(json.matches) ? json.matches : [];
        if (!cancelled) setMatches(dedupeMatchesByEventId(raw));
      } catch {
        if (!cancelled) setMatchesError("Impossibile caricare il calendario partite.");
      } finally {
        if (!cancelled) setMatchesLoading(false);
      }
    }
    void loadMatches();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bump = () => setStatsRevision((r) => r + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("storage", bump);
    window.addEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, bump);
    window.addEventListener(YELLOW_CARD_SNAPSHOT_UPDATED_EVENT, bump);
    window.addEventListener(KIOSK_INSIGHTS_LOCAL_WRITE_EVENT, bump);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(bump, 45_000);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, bump);
      window.removeEventListener(YELLOW_CARD_SNAPSHOT_UPDATED_EVENT, bump);
      window.removeEventListener(KIOSK_INSIGHTS_LOCAL_WRITE_EVENT, bump);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, []);

  const liveStats = useMemo(
    () => buildDashboardLiveStats(matches, { includeBrowserCache: browserCacheReady }),
    [matches, statsRevision, browserCacheReady]
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[#040B14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,194,255,0.14),transparent_34%),radial-gradient(circle_at_50%_55%,rgba(14,165,233,0.08),transparent_30%),linear-gradient(135deg,#040B14,#07111F_52%,#0A1628)]" />
      <div className="pointer-events-none fixed left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="relative">
        <TopBar onOpenMenu={() => setDrawerOpen(true)} email={email} />
        <MobileDrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main>
          <HeroSection />
          <FeatureCards />
          <LiveOverview stats={liveStats} matchesLoading={matchesLoading} />
          <MatchMonitorSection
            monitorMatches={liveStats.monitorMatches}
            loading={matchesLoading}
            error={matchesError}
          />
        </main>
        <Footer />
        <p className="sr-only">Utente autenticato: {email ?? "IlDodicesimo"}</p>
      </div>
    </div>
  );
}

export { HomePage, HomePage as DashboardHomePage };
