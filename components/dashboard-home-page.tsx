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
  Radar,
  Settings,
  ShieldAlert,
  Swords,
  TrendingUp,
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
import { MatchRadarHomeCta } from "@/components/match-radar/match-radar-home-cta";
import { DataRefreshScheduleBanner } from "@/components/data-refresh/data-refresh-schedule-banner";
import { EarlySeasonNoticeBanner } from "@/components/data-refresh/early-season-notice-banner";
import type { DataRefreshStatus } from "@/lib/data-refresh/status";

interface DashboardHomePageProps {
  email?: string | null;
}

const navigationItems = [
  {
    label: "Analisi partita",
    href: "/kiosk",
    icon: Swords,
    accent:
      "border-sky-400/25 bg-sky-400/10 text-sky-100 hover:border-sky-300/40 hover:bg-sky-400/15"
  },
  {
    label: "Rischio falli subiti",
    href: "/kiosk",
    icon: ShieldAlert,
    accent:
      "border-rose-400/25 bg-rose-400/10 text-rose-100 hover:border-rose-300/40 hover:bg-rose-400/15"
  },
  {
    label: "Rischio falli commessi",
    href: "/kiosk",
    icon: Gauge,
    accent:
      "border-violet-400/25 bg-violet-400/10 text-violet-100 hover:border-violet-300/40 hover:bg-violet-400/15"
  },
  {
    label: "Partite in programma",
    href: "/kiosk#kiosk-fixture-picker",
    icon: CalendarDays,
    accent:
      "border-sky-400/25 bg-sky-400/10 text-sky-100 hover:border-sky-300/40 hover:bg-sky-400/15"
  },
  {
    label: "Partite di oggi",
    href: "/kiosk/hybrid",
    icon: CalendarDays,
    accent:
      "border-blue-400/25 bg-blue-400/10 text-blue-100 hover:border-blue-300/40 hover:bg-blue-400/15"
  },
  {
    label: "Marcature difficili",
    href: "/kiosk/marcature-difficili",
    icon: ShieldAlert,
    accent:
      "border-orange-400/25 bg-orange-400/10 text-orange-100 hover:border-orange-300/40 hover:bg-orange-400/15"
  },
  {
    label: "Trend",
    href: "/kiosk/trend",
    icon: TrendingUp,
    accent:
      "border-amber-400/25 bg-amber-400/10 text-amber-100 hover:border-amber-300/40 hover:bg-amber-400/15"
  },
  {
    label: "Simulatore match",
    href: "/kiosk/simulatore-match",
    icon: Activity,
    accent:
      "border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-400/15"
  },
  {
    label: "Match Radar",
    href: "/kiosk/match-radar",
    icon: Gauge,
    accent:
      "border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/40 hover:bg-cyan-400/15"
  }
] as const;

const menuItems = [
  { label: "Dashboard", href: "/", icon: Home },
  ...navigationItems.map(({ label, href, icon }) => ({ label, href, icon })),
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
    title: "Rischio falli subiti",
    description: "Individua i giocatori più esposti ai falli degli avversari diretti.",
    href: "/kiosk",
    icon: ShieldAlert,
    color: "text-rose-300",
    glow: "shadow-[0_0_28px_rgba(244,63,94,0.12)]"
  },
  {
    title: "Rischio falli commessi",
    description: "Valuta chi ha maggior probabilità di commettere fallo nel duello.",
    href: "/kiosk",
    icon: Gauge,
    color: "text-violet-300",
    glow: "shadow-[0_0_28px_rgba(167,139,250,0.12)]"
  },
  {
    title: "Marcature difficili",
    description: "Duelli individuali complessi con indice di esposizione alla marcatura.",
    href: "/kiosk/marcature-difficili",
    icon: ShieldAlert,
    color: "text-orange-300",
    glow: "shadow-[0_0_28px_rgba(251,146,60,0.12)]"
  },
  {
    title: "Trend",
    description: "Giocatori in crescita su tiri, tiri in porta e parate nelle ultime cinque presenze.",
    href: "/kiosk/trend",
    icon: TrendingUp,
    color: "text-amber-300",
    glow: "shadow-[0_0_28px_rgba(251,191,36,0.12)]"
  },
  {
    title: "Simulatore match",
    description: "Simula lo scenario statistico pre-partita con distribuzioni probabilistiche e incertezza modellistica.",
    href: "/kiosk/simulatore-match",
    icon: Activity,
    color: "text-emerald-300",
    glow: "shadow-[0_0_28px_rgba(52,211,153,0.12)]"
  },
  {
    title: "Match Radar",
    description: "Le partite future più interessanti con motivazioni su intensità, attacco, equilibrio e profilo arbitrale.",
    href: "/kiosk/match-radar",
    icon: Radar,
    color: "text-cyan-300",
    glow: "shadow-[0_0_28px_rgba(56,189,248,0.14)]"
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

function QuickAccessButton({
  item
}: {
  item: (typeof navigationItems)[number];
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition duration-300 ${item.accent}`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="text-center leading-tight">{item.label}</span>
    </Link>
  );
}

function QuickAccessSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="mb-4 text-center sm:text-left">
        <h2 className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">Accesso rapido</h2>
        <p className="mt-2 text-sm text-slate-500">Apri subito le funzioni del menu analitico.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {navigationItems.map((item) => (
          <QuickAccessButton key={item.label} item={item} />
        ))}
      </div>
    </section>
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
        Analizza scontri diretti, falli commessi e falli subiti con dati aggiornati.
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
      label: "Partite monitorate",
      display: String(stats.monitorMatches.length),
      icon: Swords
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
          Partite: calendario future dal menu dati (fuso Europe/Roma). Giocatori e insight: ultimo salvataggio nel browser
          dopo analisi kiosk (stessa ondata dell’aggiornamento admin).
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
  const [dataRefresh, setDataRefresh] = useState<DataRefreshStatus | null>(null);
  const [statsRevision, setStatsRevision] = useState(0);
  /** Dopo mount, abilita lettura localStorage (evita mismatch SSR/client). */
  const [browserCacheReady, setBrowserCacheReady] = useState(false);

  useEffect(() => {
    setBrowserCacheReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDataRefreshSchedule() {
      try {
        const res = await fetch("/api/tactical/data-refresh-schedule", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DataRefreshStatus;
        if (!cancelled) setDataRefresh(json);
      } catch {
        // banner opzionale: nessun errore bloccante in home
      }
    }
    void loadDataRefreshSchedule();
    const id = window.setInterval(() => void loadDataRefreshSchedule(), 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      setMatchesLoading(true);
      setMatchesError(null);
      try {
        const res = await fetch("/api/tactical/matches", { cache: "no-store" });
        if (!res.ok) throw new Error("matches_unavailable");
        const json = (await res.json()) as {
          matches?: UpcomingMatchItem[];
          persistedSnapshotMissing?: boolean;
        };
        const raw = Array.isArray(json.matches) ? json.matches : [];
        if (!cancelled) {
          setMatches(dedupeMatchesByEventId(raw));
          if (raw.length === 0 && json.persistedSnapshotMissing) {
            setMatchesError(
              "Il calendario condiviso non è ancora stato preparato dall’organizzazione. Un amministratore deve caricare una volta il menù dal Tactical Hub (nessuna leva sul piano API per i lettori Pro)."
            );
          }
        }
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

  const liveStats = useMemo(() => {
    void statsRevision;
    return buildDashboardLiveStats(matches, { includeBrowserCache: browserCacheReady });
  }, [matches, statsRevision, browserCacheReady]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#040B14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,194,255,0.14),transparent_34%),radial-gradient(circle_at_50%_55%,rgba(14,165,233,0.08),transparent_30%),linear-gradient(135deg,#040B14,#07111F_52%,#0A1628)]" />
      <div className="pointer-events-none fixed left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="relative">
        <TopBar onOpenMenu={() => setDrawerOpen(true)} email={email} />
        <MobileDrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main>
          <HeroSection />
          <div className="mx-auto max-w-6xl space-y-4 px-4 pb-8">
            <EarlySeasonNoticeBanner />
            <DataRefreshScheduleBanner status={dataRefresh} />
            <MatchRadarHomeCta />
          </div>
          <QuickAccessSection />
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
