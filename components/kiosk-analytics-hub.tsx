"use client";

import { useEffect, useMemo, useState } from "react";
import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import { analyzeFoulRisk } from "@/lib/foul-risk-analysis";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import type { CompetitionScope, TacticalMetrics } from "@/lib/types";

type KioskView = "PLAYER_FRICTION" | "FOUL_RISK_SUFFERED" | "FOUL_RISK_COMMITTED";

interface UpcomingMatchItem {
  eventId: number;
  competitionSlug: string;
  competitionName: string;
  startTimestamp: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
}

export type PlayerAnalyticsPolicy = "full" | "serie_a_players";

interface KioskAnalyticsHubProps {
  initialMetrics: TacticalMetrics[];
  organizationId: string;
  fixtureId: string;
  /** `full`: sempre stats giocatori + heatmap. `serie_a_players`: pieno per Serie A, Champions, Europa e Conference (con Serie A); nessuna analisi giocatori per Serie B e altre leghe del menu. */
  playerAnalyticsPolicy?: PlayerAnalyticsPolicy;
  kioskTitle?: string;
  kioskDescription?: string;
  testingMatch?: {
    home: string;
    away: string;
    competition: string;
  };
  presetMatch?: UpcomingMatchItem;
}

const SINGLE_MATCH_MODE = process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_MODE === "1";
const SINGLE_MATCH_HOME =
  process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_HOME?.trim() || "Paris Saint-Germain";
const SINGLE_MATCH_AWAY = process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_AWAY?.trim() || "Toulouse";
const SINGLE_MATCH_COMPETITION =
  process.env.NEXT_PUBLIC_KIOSK_SINGLE_MATCH_COMPETITION?.trim() || "ligue-1";

function scopeFromCompetitionSlug(slug: string): CompetitionScope {
  if (slug.includes("champions") || slug.includes("europa") || slug.includes("conference")) return "EUROPE";
  if (
    slug.includes("fa-cup") ||
    slug.includes("coppa-italia") ||
    slug.includes("copa-del-rey") ||
    slug.includes("dfb-pokal") ||
    slug.includes("coupe-de-france")
  ) {
    return "CUP";
  }
  return "DOMESTIC";
}

/** Allineato a `normalizeCompetitionSlug` in sportapi (client-safe). */
function normalizeKioskCompetitionSlug(slug: string): string {
  const s = slug?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  return s;
}

function competitionLabel(slug: string): string {
  const key = normalizeKioskCompetitionSlug(slug);
  const labels: Record<string, string> = {
    "serie-a": "Serie A",
    "premier-league": "Premier League",
    laliga: "LaLiga",
    bundesliga: "Bundesliga",
    "ligue-1": "Ligue 1",
    "uefa-champions-league": "Champions League",
    "uefa-europa-league": "Europa League",
    "uefa-europa-conference-league": "Conference League",
    "champions-league": "Champions League",
    "europa-league": "Europa League",
    "europa-conference-league": "Conference League",
    "conference-league": "Conference League",
    "serie-b": "Serie B",
    "italy-serie-b": "Serie B"
  };
  return labels[key] ?? slug;
}

function dedupeMatchesByEventId(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  const map = new Map<number, UpcomingMatchItem>();
  for (const m of matches) {
    if (!map.has(m.eventId)) {
      map.set(m.eventId, m);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}

function formatKickoff(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizePlayerName(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toUpperCase();
}

/**
 * Canonical key for de-duping "visually same" players.
 * We intentionally do NOT rely on provider playerId because sometimes it duplicates the same player with different IDs.
 */
function playerStableKey(item: TacticalMetrics): string {
  return `t:${item.teamId}|n:${normalizePlayerName(item.playerName)}`;
}

function formatStat(value: unknown): string {
  return numeric(value).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function ouPick(predicted: number, line: number): "Over" | "Under" {
  // Con linea x.5, >= è equivalente a "Over". Manteniamo >= per stabilità sui casi limite.
  return predicted >= line ? "Over" : "Under";
}

function formatOdds(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function predictedCardsFromMetric(m: TacticalMetrics): number {
  // Proxy semplice e stabile: più falli => più rischio cartellino; piccolo boost se H2H ha già avuto cartellino.
  return m.foulsCommittedLastFiveAvg * 0.18 + (m.h2hHadCard ? 0.12 : 0);
}

const LAST_TWO_MIN_SAMPLES = 2;

function TopPlayersSeasonTable({
  title,
  rows,
  valueSelector,
  onTopPlayersComputed
}: {
  title: string;
  rows: TacticalMetrics[];
  valueSelector: (item: TacticalMetrics) => number;
  onTopPlayersComputed?: (top: TacticalMetrics[]) => void;
}) {
  const uniqueRows = useMemo(() => {
    const map = new Map<string, TacticalMetrics>();
    for (const item of rows) {
      const key = playerStableKey(item);
      const current = map.get(key);
      if (!current || valueSelector(item) > valueSelector(current)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [rows, valueSelector]);

  const topRows = useMemo(
    () => [...uniqueRows].sort((a, b) => valueSelector(b) - valueSelector(a)).slice(0, 5),
    [uniqueRows, valueSelector]
  );

  useEffect(() => {
    onTopPlayersComputed?.(topRows);
  }, [onTopPlayersComputed, topRows]);

  return (
    <article className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-cyan-200">{title}</h3>
      <p className="mb-3 text-[11px] text-slate-500">Ordinamento: media stagionale (API overall / campionato).</p>
      {topRows.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun dato giocatore disponibile.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[360px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/95 text-slate-300">
              <tr className="border-b border-slate-700">
                <th className="px-2 py-2 font-semibold">Giocatore</th>
                <th className="px-2 py-2 font-semibold">Squadra</th>
                <th className="px-2 py-2 font-semibold">Stagione</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((player) => (
                <tr key={playerStableKey(player)} className="border-b border-slate-800/80">
                  <td className="px-2 py-2 text-slate-100">{player.playerName}</td>
                  <td className="px-2 py-2 text-slate-300">{player.team}</td>
                  <td className="px-2 py-2 font-semibold text-cyan-100">{formatStat(valueSelector(player))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function TopPlayersLastTwoTable({
  title,
  rows,
  valueSelector,
  sampleCountSelector,
  excludePlayers
}: {
  title: string;
  rows: TacticalMetrics[];
  valueSelector: (item: TacticalMetrics) => number;
  sampleCountSelector: (item: TacticalMetrics) => number | undefined;
  excludePlayers?: Set<string>;
}) {
  const eligible = useMemo(
    () =>
      rows.filter((item) => (sampleCountSelector(item) ?? LAST_TWO_MIN_SAMPLES) >= LAST_TWO_MIN_SAMPLES),
    [rows, sampleCountSelector]
  );

  const filtered = useMemo(() => {
    if (!excludePlayers?.size) return eligible;
    return eligible.filter((item) => !excludePlayers.has(playerStableKey(item)));
  }, [eligible, excludePlayers]);

  const uniqueRows = useMemo(() => {
    const map = new Map<string, TacticalMetrics>();
    for (const item of filtered) {
      const key = playerStableKey(item);
      const current = map.get(key);
      if (!current || valueSelector(item) > valueSelector(current)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [filtered, valueSelector]);

  const topRows = useMemo(
    () => [...uniqueRows].sort((a, b) => valueSelector(b) - valueSelector(a)).slice(0, 5),
    [uniqueRows, valueSelector]
  );

  return (
    <article className="rounded-xl border border-violet-400/20 bg-slate-950/70 p-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-violet-200">{title}</h3>
      <p className="mb-3 text-[11px] text-slate-500">
        Ordinamento: ultime {LAST_TWO_MIN_SAMPLES} partite di campionato con presenza in formazione; esclusi i
        giocatori senza abbastanza campioni.
      </p>
      {topRows.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nessun giocatore con almeno {LAST_TWO_MIN_SAMPLES} partite campionate per questa metrica.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[360px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/95 text-slate-300">
              <tr className="border-b border-slate-700">
                <th className="px-2 py-2 font-semibold">Giocatore</th>
                <th className="px-2 py-2 font-semibold">Squadra</th>
                <th className="px-2 py-2 font-semibold">Ultimi 2</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((player) => (
                <tr key={playerStableKey(player)} className="border-b border-slate-800/80">
                  <td className="px-2 py-2 text-slate-100">{player.playerName}</td>
                  <td className="px-2 py-2 text-slate-300">{player.team}</td>
                  <td className="px-2 py-2 font-semibold text-violet-100">{formatStat(valueSelector(player))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function KioskAnalyticsHub(props: KioskAnalyticsHubProps) {
  const {
    initialMetrics,
    fixtureId,
    playerAnalyticsPolicy = "full",
    kioskTitle = "Kiosk Tactical Menu",
    kioskDescription,
    testingMatch,
    presetMatch
  } = props;
  const [view, setView] = useState<KioskView>("PLAYER_FRICTION");
  const [metrics, setMetrics] = useState<TacticalMetrics[]>(initialMetrics);
  const [playerDetailLevel, setPlayerDetailLevel] = useState<"full" | "team_only">("full");

  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  /** Aggiornato ogni minuto: ricalcola il filtro “solo future” senza nuove richieste API. */
  const [matchListTimeTick, setMatchListTimeTick] = useState(0);
  const [selectedCompetition, setSelectedCompetition] = useState<string>("ALL");
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [loadingMatchInsights, setLoadingMatchInsights] = useState(false);
  const [matchInsightsError, setMatchInsightsError] = useState<string | null>(null);
  /** Incrementato dal pulsante “Aggiorna”: la prossima richiesta match-insights usa forceRefresh e bypass cache SportAPI. */
  const [insightsRefreshNonce, setInsightsRefreshNonce] = useState(0);
  const [seasonShooterKeys, setSeasonShooterKeys] = useState<Set<string>>(new Set());
  const [seasonFoulsCommittedKeys, setSeasonFoulsCommittedKeys] = useState<Set<string>>(new Set());
  const [seasonFoulsSufferedKeys, setSeasonFoulsSufferedKeys] = useState<Set<string>>(new Set());

  /** `undefined` = caricamento in corso o non avviato; array = risposta API (anche vuota). */
  const [serieARoundFormRows, setSerieARoundFormRows] = useState<TacticalMetrics[] | undefined>(undefined);
  const [serieARoundFormLoading, setSerieARoundFormLoading] = useState(false);
  const [serieARoundFormUsedFallback, setSerieARoundFormUsedFallback] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMatchListTimeTick((t) => t + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingMatches = useMemo(
    () => {
      // Recompute time-based "future match" filtering every minute.
      void matchListTimeTick;
      return filterMatchesKickoffInFuture(matches);
    },
    [matches, matchListTimeTick]
  );

  const visibleMatches = useMemo(() => {
    if (selectedCompetition === "ALL") return upcomingMatches;
    const want = normalizeKioskCompetitionSlug(selectedCompetition);
    return upcomingMatches.filter(
      (item) => normalizeKioskCompetitionSlug(item.competitionSlug) === want
    );
  }, [upcomingMatches, selectedCompetition]);

  const leagueFilterSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const m of upcomingMatches) {
      const n = normalizeKioskCompetitionSlug(m.competitionSlug);
      if (n) set.add(n);
    }
    return Array.from(set).sort();
  }, [upcomingMatches]);

  useEffect(() => {
    setSelectedMatchId((prev) => {
      if (visibleMatches.length === 0) return prev;
      if (visibleMatches.some((m) => m.eventId === prev)) return prev;
      return visibleMatches[0].eventId;
    });
  }, [visibleMatches]);

  const selectedMatch = useMemo(
    () => visibleMatches.find((item) => item.eventId === selectedMatchId) ?? visibleMatches[0] ?? null,
    [visibleMatches, selectedMatchId]
  );

  const selectedMatchMetrics = useMemo(() => {
    if (!selectedMatch) return [];
    const allowed = new Set([selectedMatch.homeTeam.id, selectedMatch.awayTeam.id]);
    return metrics.filter((item) => allowed.has(item.teamId));
  }, [metrics, selectedMatch]);

  const selectedMetricsByRosterKey = useMemo(() => {
    const map = new Map<string, TacticalMetrics>();
    for (const m of selectedMatchMetrics) {
      const key = `${m.teamId}|${normalizePlayerName(m.playerName)}`;
      const prev = map.get(key);
      // Preferisci la riga che ha linee odds (quando presenti) o playerId.
      if (!prev) {
        map.set(key, m);
        continue;
      }
      const prevHasOdds = Boolean(prev.oddsFoulsCommittedLine || prev.oddsCardsLine);
      const nextHasOdds = Boolean(m.oddsFoulsCommittedLine || m.oddsCardsLine);
      if (nextHasOdds && !prevHasOdds) {
        map.set(key, m);
        continue;
      }
      const prevHasId = typeof prev.playerId === "number" && prev.playerId > 0;
      const nextHasId = typeof m.playerId === "number" && m.playerId > 0;
      if (nextHasId && !prevHasId) map.set(key, m);
    }
    return map;
  }, [selectedMatchMetrics]);

  const matchFrictionPairs = useMemo(() => {
    if (!selectedMatch) return [];
    const byId = new Map<number, TacticalMetrics>();
    const byName = new Map<string, TacticalMetrics[]>();
    for (const item of selectedMatchMetrics) {
      if (typeof item.playerId === "number" && item.playerId > 0) {
        byId.set(item.playerId, item);
      }
      const key = item.playerName.toUpperCase();
      const bucket = byName.get(key);
      if (bucket) bucket.push(item);
      else byName.set(key, [item]);
    }
    const map = new Map<string, { left: TacticalMetrics; right: TacticalMetrics; pairPriority: number }>();

    for (const item of selectedMatchMetrics) {
      if (!item.sparkDuel) continue;
      const duelBId = item.sparkDuel.playerBId;
      const candidateById =
        typeof duelBId === "number" && duelBId > 0 ? byId.get(duelBId) ?? null : null;
      const candidatesByName = byName.get(item.sparkDuel.playerB.toUpperCase()) ?? [];
      const candidate =
        candidateById && candidateById.teamId !== item.teamId
          ? candidateById
          : candidatesByName.find((row) => row.teamId !== item.teamId) ?? null;
      if (!candidate) continue;
      if (candidate.teamId === item.teamId) continue;

      const teams = new Set([item.teamId, candidate.teamId]);
      if (!teams.has(selectedMatch.homeTeam.id) || !teams.has(selectedMatch.awayTeam.id)) continue;

      const directScore =
        item.foulsCommittedSeasonAvg +
        candidate.foulsSufferedSeasonAvg +
        item.foulsCommittedLastTwoAvg * 0.5 +
        candidate.foulsSufferedLastTwoAvg * 0.5;
      const reverseScore =
        candidate.foulsCommittedSeasonAvg +
        item.foulsSufferedSeasonAvg +
        candidate.foulsCommittedLastTwoAvg * 0.5 +
        item.foulsSufferedLastTwoAvg * 0.5;

      const left = directScore >= reverseScore ? item : candidate;
      const right = directScore >= reverseScore ? candidate : item;

      const key =
        typeof left.playerId === "number" && typeof right.playerId === "number"
          ? `id:${Math.min(left.playerId, right.playerId)}|${Math.max(left.playerId, right.playerId)}`
          : [left.playerName, right.playerName].sort().join("|");
      const pairPriority =
        left.sparkIndex +
        right.sparkIndex +
        (left.foulsCommittedSeasonAvg + right.foulsSufferedSeasonAvg) * 5;

      const current = map.get(key);
      if (!current || pairPriority > current.pairPriority) {
        map.set(key, { left, right, pairPriority });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.pairPriority - a.pairPriority);
    const usedPairs = new Set<string>();
    const usedPlayers = new Set<string>();
    const maxInterestingFrictionPairs = 4;
    const out: Array<{ left: TacticalMetrics; right: TacticalMetrics; pairPriority: number }> = [];
    for (const pair of sorted) {
      if (out.length >= maxInterestingFrictionPairs) break;
      const aId = pair.left.playerId;
      const bId = pair.right.playerId;
      const pairKey =
        typeof aId === "number" && typeof bId === "number"
          ? `id:${Math.min(aId, bId)}|${Math.max(aId, bId)}`
          : [pair.left.playerName.trim().toUpperCase(), pair.right.playerName.trim().toUpperCase()]
              .sort()
              .join("|");
      if (usedPairs.has(pairKey)) continue;
      const aKey =
        typeof aId === "number" ? `id:${aId}` : `n:${pair.left.playerName.trim().toUpperCase()}`;
      const bKey =
        typeof bId === "number" ? `id:${bId}` : `n:${pair.right.playerName.trim().toUpperCase()}`;
      if (usedPlayers.has(aKey) || usedPlayers.has(bKey)) continue;
      usedPairs.add(pairKey);
      usedPlayers.add(aKey);
      usedPlayers.add(bKey);
      out.push(pair);
    }
    return out;
  }, [selectedMatch, selectedMatchMetrics]);

  const playerRowsNoKeepers = useMemo(
    () => selectedMatchMetrics.filter((item) => item.roleIcon !== "🧤"),
    [selectedMatchMetrics]
  );
  const goalkeeperRows = useMemo(
    () => selectedMatchMetrics.filter((item) => item.roleIcon === "🧤"),
    [selectedMatchMetrics]
  );

  const playerAnalyticsView: KioskView | null =
    view === "PLAYER_FRICTION" || view === "FOUL_RISK_SUFFERED" || view === "FOUL_RISK_COMMITTED"
      ? view
      : null;

  const foulRiskSufferedEntries = useMemo(() => {
    if (!selectedMatch) return [];
    return analyzeFoulRisk({
      metrics: selectedMatchMetrics,
      homeTeamId: selectedMatch.homeTeam.id,
      awayTeamId: selectedMatch.awayTeam.id,
      kind: "suffered"
    });
  }, [selectedMatch, selectedMatchMetrics]);

  const foulRiskCommittedEntries = useMemo(() => {
    if (!selectedMatch) return [];
    return analyzeFoulRisk({
      metrics: selectedMatchMetrics,
      homeTeamId: selectedMatch.homeTeam.id,
      awayTeamId: selectedMatch.awayTeam.id,
      kind: "committed"
    });
  }, [selectedMatch, selectedMatchMetrics]);

  const hasMatchFrameHeatmaps = useMemo(
    () =>
      selectedMatchMetrics.some(
        (m) => m.roleIcon !== "🧤" && (m.heatmapPointsMatchFrame?.length ?? 0) >= 3
      ),
    [selectedMatchMetrics]
  );

  const showSerieAFormFromFriction =
    fixtureId === "kiosk-hybrid" &&
    Boolean(selectedMatch && normalizeKioskCompetitionSlug(selectedMatch.competitionSlug) === "serie-a") &&
    playerDetailLevel === "full";

  useEffect(() => {
    if (!showSerieAFormFromFriction || !selectedMatch) {
      setSerieARoundFormRows(undefined);
      setSerieARoundFormLoading(false);
      setSerieARoundFormUsedFallback(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setSerieARoundFormRows(undefined);
    setSerieARoundFormUsedFallback(false);
    setSerieARoundFormLoading(true);

    async function loadRoundForm() {
      try {
        const res = await fetch(
          `/api/tactical/serie-a-round-form?eventId=${selectedMatch.eventId}`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) {
          if (!cancelled) {
            setSerieARoundFormRows([]);
            setSerieARoundFormUsedFallback(true);
          }
          return;
        }
        const json = (await res.json()) as { metrics?: TacticalMetrics[] };
        const list = Array.isArray(json.metrics) ? json.metrics : [];
        if (!cancelled) {
          setSerieARoundFormRows(list);
          setSerieARoundFormUsedFallback(list.length === 0);
        }
      } catch {
        if (!cancelled) {
          setSerieARoundFormRows([]);
          setSerieARoundFormUsedFallback(true);
        }
      } finally {
        if (!cancelled) setSerieARoundFormLoading(false);
      }
    }

    void loadRoundForm();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [showSerieAFormFromFriction, selectedMatch]);

  const serieAFormLeaders = useMemo(() => {
    if (!showSerieAFormFromFriction) return null;
    if (serieARoundFormRows === undefined) return null;
    const TOP = 10;

    const baseRows =
      serieARoundFormRows.length > 0 ? serieARoundFormRows : selectedMatchMetrics;

    /** Stessa persona può comparire più volte in `metrics` (merge supplementari / id vs nome): una sola riga per squadra+nome. */
    const normalizePlayerName = (name: string) => name.replace(/\s+/g, " ").trim().toUpperCase();
    const rosterKey = (m: TacticalMetrics) => `${m.teamId}|${normalizePlayerName(m.playerName)}`;
    const pickBetterRow = (a: TacticalMetrics, b: TacticalMetrics): TacticalMetrics => {
      const aId = typeof a.playerId === "number" && a.playerId > 0;
      const bId = typeof b.playerId === "number" && b.playerId > 0;
      if (aId && !bId) return a;
      if (bId && !aId) return b;
      return a;
    };
    const byRoster = new Map<string, TacticalMetrics>();
    for (const m of baseRows) {
      const k = rosterKey(m);
      const prev = byRoster.get(k);
      byRoster.set(k, prev ? pickBetterRow(m, prev) : m);
    }
    const rowsUnique = Array.from(byRoster.values());

    const playerKey = (m: TacticalMetrics): string => rosterKey(m);

    const used = new Set<string>();
    const takeUnique = (
      predicate: (m: TacticalMetrics) => boolean,
      score: (m: TacticalMetrics) => number
    ): TacticalMetrics[] => {
      const picked = [...rowsUnique]
        .filter(predicate)
        .filter((m) => !used.has(playerKey(m)))
        .sort((a, b) => score(b) - score(a))
        .slice(0, TOP);
      for (const m of picked) used.add(playerKey(m));
      return picked;
    };

    /**
     * Ordine di assegnazione: prima portieri (parate), poi fuori porta (tiri), poi tutti per i falli.
     * Così i portieri non “consumano” slot nelle altre classifiche e i nomi restano distinti tra le quattro top.
     */
    const saves = takeUnique((m) => m.roleIcon === "🧤", (m) => m.savesLastFiveAvg);
    const shots = takeUnique((m) => m.roleIcon !== "🧤", (m) => m.shotsLastFiveAvg);
    const foulsCommitted = takeUnique(() => true, (m) => {
      const h2h = (m.h2hFoulsCommitted ?? 0) * 0.6;
      const card = m.h2hHadCard ? 0.35 + (m.h2hRedCards ?? 0) * 0.35 : 0;
      return m.foulsCommittedLastFiveAvg + h2h + card;
    });
    const foulsSuffered = takeUnique(() => true, (m) => {
      const h2h = (m.h2hFoulsSuffered ?? 0) * 0.6;
      const card = m.h2hHadCard ? 0.25 : 0;
      return m.foulsSufferedLastFiveAvg + h2h + card;
    });

    return { foulsCommitted, foulsSuffered, shots, saves };
  }, [showSerieAFormFromFriction, selectedMatchMetrics, serieARoundFormRows]);

  useEffect(() => {
    async function loadMatches() {
      if (presetMatch) {
        const presetUpcoming = filterMatchesKickoffInFuture([presetMatch]);
        setMatches(presetUpcoming);
        setSelectedMatchId(presetUpcoming[0]?.eventId ?? 0);
        setMatchesError(null);
        return;
      }
      const singleMatchFilter = testingMatch ?? (SINGLE_MATCH_MODE
        ? {
            home: SINGLE_MATCH_HOME,
            away: SINGLE_MATCH_AWAY,
            competition: SINGLE_MATCH_COMPETITION
          }
        : null);
      const matchesUrl = singleMatchFilter
        ? `/api/tactical/matches?home=${encodeURIComponent(singleMatchFilter.home)}&away=${encodeURIComponent(
            singleMatchFilter.away
          )}&competition=${encodeURIComponent(singleMatchFilter.competition)}`
        : "/api/tactical/matches";
      const response = await fetch(matchesUrl, { cache: "no-store" });
      if (!response.ok) {
        setMatchesError("Impossibile caricare il menu partite.");
        return;
      }
      let json = (await response.json()) as { matches?: UpcomingMatchItem[] };
      let list = json.matches ?? [];
      if (singleMatchFilter && list.length === 0) {
        const fallback = await fetch("/api/tactical/matches", { cache: "no-store" });
        if (fallback.ok) {
          json = (await fallback.json()) as { matches?: UpcomingMatchItem[] };
          list = json.matches ?? [];
        }
      }
      const normalized = dedupeMatchesByEventId(
        list.map((m) => ({
          ...m,
          competitionSlug: normalizeKioskCompetitionSlug(m.competitionSlug)
        }))
      );
      setMatches(normalized);
      const upcomingAfterFetch = filterMatchesKickoffInFuture(normalized);
      if (upcomingAfterFetch.length > 0) {
        setSelectedMatchId(upcomingAfterFetch[0].eventId);
      }
      setMatchesError(null);
    }
    void loadMatches();
  }, [presetMatch, testingMatch]);

  useEffect(() => {
    setInsightsRefreshNonce(0);
  }, [selectedMatch?.eventId]);

  useEffect(() => {
    if (!selectedMatch) {
      setMetrics([]);
      setPlayerDetailLevel("full");
      return;
    }

    const scope = scopeFromCompetitionSlug(selectedMatch.competitionSlug);
    let cancelled = false;
    const abort = new AbortController();
    const forceRefreshParam =
      insightsRefreshNonce > 0 || testingMatch || presetMatch ? "&forceRefresh=1" : "";

    async function loadMatchInsights() {
      setLoadingMatchInsights(true);
      setMatchInsightsError(null);

      const playerAnalyticsParam =
        playerAnalyticsPolicy === "serie_a_players" ? "&playerAnalytics=serie_a_players" : "";
      try {
        const response = await fetch(
          `/api/tactical/match-insights?eventId=${selectedMatch.eventId}&homeTeamId=${selectedMatch.homeTeam.id}&awayTeamId=${selectedMatch.awayTeam.id}&homeTeamName=${encodeURIComponent(
            selectedMatch.homeTeam.name
          )}&awayTeamName=${encodeURIComponent(
            selectedMatch.awayTeam.name
          )}&competitionSlug=${encodeURIComponent(selectedMatch.competitionSlug)}&scope=${scope}${forceRefreshParam}${playerAnalyticsParam}`,
          { cache: "no-store", signal: abort.signal }
        );

        if (!response.ok) {
          if (!cancelled) {
            setMatchInsightsError("Dati match non disponibili (insights). Riprova o usa Aggiorna dati.");
            setLoadingMatchInsights(false);
          }
          return;
        }

        const json = (await response.json()) as {
          metrics?: TacticalMetrics[];
          playerDetailLevel?: "full" | "team_only";
        };

        if (!cancelled) {
          setMetrics(Array.isArray(json.metrics) ? json.metrics : []);
          setPlayerDetailLevel(json.playerDetailLevel === "team_only" ? "team_only" : "full");
          setLoadingMatchInsights(false);
        }
      } catch {
        if (abort.signal.aborted) return;
        if (!cancelled) {
          setMatchInsightsError("Dati match non disponibili (insights). Riprova o usa Aggiorna dati.");
          setLoadingMatchInsights(false);
        }
      }
    }

    void loadMatchInsights();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [
    selectedMatch,
    insightsRefreshNonce,
    playerAnalyticsPolicy,
    testingMatch,
    presetMatch
  ]);

  return (
    <section className="space-y-5 rounded-2xl border border-cyan-400/30 bg-slate-900/50 p-3 sm:space-y-6 sm:p-5">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-cyan-300 sm:text-2xl">{kioskTitle}</h2>
        {kioskDescription ? (
          <p className="text-xs text-slate-400 sm:text-sm">{kioskDescription}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("PLAYER_FRICTION")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide ${
              view === "PLAYER_FRICTION"
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            Scontri in campo
          </button>
          <button
            type="button"
            onClick={() => setView("FOUL_RISK_SUFFERED")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide ${
              view === "FOUL_RISK_SUFFERED"
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            Rischio falli subiti
          </button>
          <button
            type="button"
            onClick={() => setView("FOUL_RISK_COMMITTED")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide ${
              view === "FOUL_RISK_COMMITTED"
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            Rischio falli commessi
          </button>
        </div>
      </header>

      {showSerieAFormFromFriction ? (
        <article className="rounded-xl border border-amber-400/25 bg-slate-950/80 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-200">
            Serie A — forma recente (giornata intera)
          </h3>
          <p className="mb-4 text-[11px] leading-relaxed text-slate-500">
            Top 10 calcolate sul pool di <strong>tutti i giocatori coinvolti nella stessa giornata</strong> di Serie A del
            match selezionato (stesso <code className="text-slate-400">round</code>), con le stesse medie sulle ultime
            partite usate per il modello scontri.{" "}
            <strong>Ogni giocatore compare al massimo in una sola classifica</strong> (ordine: parate → tiri → falli
            commessi → subiti).
          </p>
          {serieARoundFormUsedFallback ? (
            <p className="mb-3 rounded-lg border border-amber-600/40 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-100/95">
              Dati giornata non disponibili: classifica provvisoria solo sulle due squadre del prossimo match (come il
              caricamento match-insights).
            </p>
          ) : null}
          {serieARoundFormRows === undefined || serieARoundFormLoading ? (
            <p className="text-sm text-slate-400">Caricamento giocatori della giornata Serie A…</p>
          ) : serieAFormLeaders ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  ["Falli commessi (media ultimi 5)", serieAFormLeaders.foulsCommitted, (m: TacticalMetrics) => m.foulsCommittedLastFiveAvg, (m: TacticalMetrics) => m.foulsCommittedLastFiveSampleCount ?? 0],
                  ["Falli subiti (media ultimi 5)", serieAFormLeaders.foulsSuffered, (m: TacticalMetrics) => m.foulsSufferedLastFiveAvg, (m: TacticalMetrics) => m.foulsSufferedLastFiveSampleCount ?? 0],
                  ["Tiri (media ultimi 5)", serieAFormLeaders.shots, (m: TacticalMetrics) => m.shotsLastFiveAvg, (m: TacticalMetrics) => m.shotsLastFiveSampleCount ?? 0],
                  ["Parate (media ultimi 5)", serieAFormLeaders.saves, (m: TacticalMetrics) => m.savesLastFiveAvg, (m: TacticalMetrics) => m.savesLastFiveSampleCount ?? 0]
                ] as const
              ).map(([title, list, val, nMatches]) => (
                <div key={title} className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-200">{title}</p>
                  {list.length === 0 ? (
                    <p className="text-xs text-slate-500">Nessun dato disponibile.</p>
                  ) : (
                    <ol className="space-y-1.5 text-xs">
                      {list.map((m, idx) => (
                        <li key={`${title}-${m.playerId ?? m.playerName}-${idx}`} className="flex justify-between gap-2">
                          <span className="text-slate-300">
                            <span className="font-semibold text-amber-100/90">{idx + 1}.</span> {m.playerName}{" "}
                            <span className="text-slate-500">({m.team})</span>
                            {title.startsWith("Falli ") && m.h2hEventId ? (
                              <span className="ml-2 text-[10px] text-slate-500">
                                H2H:{" "}
                                <span className="font-mono text-slate-400">
                                  {title.includes("commessi")
                                    ? formatStat(m.h2hFoulsCommitted ?? 0)
                                    : formatStat(m.h2hFoulsSuffered ?? 0)}
                                </span>
                                {m.h2hHadCard ? (
                                  <span className="ml-1 text-amber-200/90">
                                    {m.h2hRedCards ? "🟥" : "🟨"}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                            {title.includes("Falli commessi") && typeof m.oddsFoulsCommittedLine === "number" ? (
                              <span className="ml-2 text-[10px] text-slate-500">
                                Linea:{" "}
                                <span className="font-mono text-slate-300">
                                  {ouPick(m.foulsCommittedLastFiveAvg, m.oddsFoulsCommittedLine)}{" "}
                                  {m.oddsFoulsCommittedLine.toFixed(1)}
                                </span>
                                <span className="ml-1 font-mono text-slate-500">
                                  ({formatOdds(
                                    ouPick(m.foulsCommittedLastFiveAvg, m.oddsFoulsCommittedLine) === "Over"
                                      ? m.oddsFoulsCommittedOver
                                      : m.oddsFoulsCommittedUnder
                                  )})
                                </span>
                                {m.oddsBookmaker ? (
                                  <span className="ml-1 text-[10px] text-slate-600">{m.oddsBookmaker}</span>
                                ) : null}
                              </span>
                            ) : null}
                            {title.includes("Falli subiti") && typeof m.oddsCardsLine === "number" ? (
                              <span className="ml-2 text-[10px] text-slate-500">
                                Cartellino:{" "}
                                <span className="font-mono text-slate-300">
                                  {(() => {
                                    const predCards = m.foulsCommittedLastFiveAvg * 0.18 + (m.h2hHadCard ? 0.12 : 0);
                                    return `${ouPick(predCards, m.oddsCardsLine)} ${m.oddsCardsLine.toFixed(1)}`;
                                  })()}
                                </span>
                                <span className="ml-1 font-mono text-slate-500">
                                  ({(() => {
                                    const predCards = m.foulsCommittedLastFiveAvg * 0.18 + (m.h2hHadCard ? 0.12 : 0);
                                    return formatOdds(
                                      ouPick(predCards, m.oddsCardsLine) === "Over"
                                        ? m.oddsCardsOver
                                        : m.oddsCardsUnder
                                    );
                                  })()}
                                  )
                                </span>
                                {m.oddsBookmaker ? (
                                  <span className="ml-1 text-[10px] text-slate-600">{m.oddsBookmaker}</span>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 font-mono text-slate-200">
                            {formatStat(val(m))}
                            <span className="text-slate-500">
                              {" "}
                              / {Math.min(5, nMatches(m))} p.
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCompetition("ALL")}
              className={`rounded-lg border px-3 py-2 text-xs ${
                selectedCompetition === "ALL"
                  ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              Tutti
            </button>
            {leagueFilterSlugs.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => setSelectedCompetition(slug)}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  normalizeKioskCompetitionSlug(selectedCompetition) === slug
                    ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                {competitionLabel(slug)}
              </button>
            ))}
            </div>
            <button
              type="button"
              onClick={() => setInsightsRefreshNonce((n) => n + 1)}
              disabled={!selectedMatch || loadingMatchInsights}
              className="shrink-0 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aggiorna dati
            </button>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            {visibleMatches.map((match) => (
              <button
                key={match.eventId}
                type="button"
                onClick={() => setSelectedMatchId(match.eventId)}
                className={`rounded-xl border p-3 text-left ${
                  selectedMatch?.eventId === match.eventId
                    ? "border-cyan-300 bg-cyan-400/10"
                    : "border-slate-700 bg-slate-900/40"
                }`}
              >
                <p className="text-xs uppercase text-slate-400">
                  {competitionLabel(match.competitionSlug)}
                </p>
                <p className="text-sm font-semibold text-slate-100">
                  {match.homeTeam.name} vs {match.awayTeam.name}
                </p>
                <p className="text-xs text-slate-400">{formatKickoff(match.startTimestamp)}</p>
              </button>
            ))}
          </div>

          {presetMatch && !matchesError && matches.length === 0 ? (
            <p className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
              La partita preimpostata ha già calcio d&apos;inizio passato: non viene mostrata nel menu.
            </p>
          ) : null}
          {!presetMatch && !matchesError && matches.length === 0 ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Nessuna partita nel menu: controlla la chiave SportAPI, il budget e le variabili d&apos;ambiente del
              calendario (es. <code className="text-xs">TACTICAL_LOOKAHEAD_DAYS</code>). Senza partite non è possibile
              caricare le analisi giocatori.
            </p>
          ) : null}
          {!matchesError && matches.length > 0 && upcomingMatches.length === 0 ? (
            <p className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
              Tutte le partite caricate hanno già il calcio d’inizio nel passato: in menu restano solo match non ancora
              giocati.
            </p>
          ) : null}
          {upcomingMatches.length > 0 && !selectedMatch ? (
            <p className="text-sm text-slate-400">Seleziona una partita dalla lista sopra.</p>
          ) : null}

          {matchesError ? <p className="text-sm text-rose-300">{matchesError}</p> : null}

          {loadingMatchInsights && selectedMatch ? (
            <p className="text-sm text-slate-400">Caricamento analisi giocatori…</p>
          ) : null}
          {matchInsightsError ? <p className="text-sm text-rose-300">{matchInsightsError}</p> : null}
          {playerDetailLevel === "team_only" ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Per questa competizione il menu ibrido non carica l&apos;analisi giocatori (es.{" "}
              <strong>Serie B</strong>). Restano attive <strong>Serie A</strong>,{" "}
              <strong>Champions League</strong>, <strong>Europa League</strong> e{" "}
              <strong>Conference League</strong> (con squadre di Serie A) per scontri e heatmap.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {playerDetailLevel === "team_only" ? (
            <div className="rounded-xl border border-slate-600 bg-slate-950/70 p-6 text-center">
              <p className="text-base text-slate-200">
                Per questa lega non sono disponibili scontri in campo nè heatmap giocatori nel menu ibrido.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Le analisi giocatori restano attive per Serie A, Champions League, Europa League e Conference League
                (con squadre di Serie A), per limitare le chiamate API.
              </p>
            </div>
          ) : (
            <>
              {playerAnalyticsView === "PLAYER_FRICTION" ? (
                <p className="text-sm text-slate-300">
                  Per la partita selezionata vengono evidenziati i <strong>4 scontri più interessanti</strong> tra
                  giocatori avversari (priorità a sovrapposizione heatmap e profilo falli), con mappa del campo. Per
                  Champions, Europa e Conference le <strong>medie falli</strong> e lo <strong>storico partite</strong>{" "}
                  usano il <strong>campionato domestico</strong> di ogni squadra (più partite), non solo la fase UEFA.
                </p>
              ) : playerAnalyticsView === "FOUL_RISK_SUFFERED" ? (
                <p className="text-sm text-slate-300">
                  Giocatori la cui <strong>heatmap stagionale</strong> (stesso orientamento degli scontri) si sovrappone
                  in modo significativo a avversari con media <strong>falli commessi &gt; 1,00</strong> a partita in
                  campionato: possibile esposizione a falli subiti.
                </p>
              ) : (
                <p className="text-sm text-slate-300">
                  Giocatori con forte incrocio territoriale verso avversari che <strong>subiscono in media più di 1,00</strong>{" "}
                  falli a partita: contestazione frequente e rischio di entrare in situazioni da fallo commesso.
                </p>
              )}

              {!hasMatchFrameHeatmaps ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
                  Heatmap giocatore nel frame partita non disponibili (cache precedente). Ricarica i dati del match o
                  attendi il prossimo aggiornamento insights.
                </p>
              ) : null}

              {playerAnalyticsView === "PLAYER_FRICTION" ? (
                <>
                  {matchFrictionPairs.length === 0 ? (
                    <p className="text-sm text-amber-200">
                      Per questa partita non risultano scontri tra giocatori particolarmente evidenti.
                    </p>
                  ) : null}
                  {matchFrictionPairs.map((pair, idx) => (
                    <section key={`${pair.left.playerName}-${pair.right.playerName}-${idx}`} className="space-y-3">
                      <p className="text-xs uppercase tracking-wide text-cyan-300">
                        Scontro {idx + 1} — tra i più interessanti
                      </p>
                      <p className="text-sm text-slate-200">{pair.left.sparkNarrative}</p>
                      {pair.left.sparkFrictionHeatmap ? (
                        <div className="rounded-xl border border-emerald-500/25 bg-slate-950/80 p-4 shadow-inner">
                          <p className="mb-3 text-xs font-medium text-slate-400">
                            Mappa del campo — dove i due giocatori sono stati più presenti in stagione
                          </p>
                          <FrictionPitchHeatmap {...pair.left.sparkFrictionHeatmap} />
                        </div>
                      ) : null}
                      {pair.left.sparkFrictionExplanation ? (
                        <p className="rounded-xl border border-slate-600/50 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-200">
                          {pair.left.sparkFrictionExplanation}
                        </p>
                      ) : null}
                      <div className="grid gap-4 lg:grid-cols-2">
                        <article className="rounded-xl border border-cyan-400/25 bg-slate-950/70 p-4">
                          <p className="text-sm font-semibold text-slate-100">{pair.left.playerName}</p>
                          <p className="text-xs text-slate-400">{pair.left.team}</p>
                          <p className="mt-2 text-sm text-slate-300">
                            Falli commessi in media (campionato): circa {pair.left.foulsCommittedSeasonAvg.toFixed(1)} a
                            partita.
                          </p>
                        </article>
                        <article className="rounded-xl border border-violet-400/25 bg-slate-950/70 p-4">
                          <p className="text-sm font-semibold text-slate-100">{pair.right.playerName}</p>
                          <p className="text-xs text-slate-400">{pair.right.team}</p>
                          <p className="mt-2 text-sm text-slate-300">
                            Falli subiti in media (campionato): circa {pair.right.foulsSufferedSeasonAvg.toFixed(1)} a
                            partita.
                          </p>
                        </article>
                      </div>
                    </section>
                  ))}
                </>
              ) : playerAnalyticsView === "FOUL_RISK_SUFFERED" ? (
                foulRiskSufferedEntries.length === 0 ? (
                  <p className="text-sm text-amber-200">
                    Nessun giocatore supera le soglie di sovrapposizione heatmap con avversari “fisici” (falli commessi
                    &gt; 1,00) per questa partita.
                  </p>
                ) : (
                  foulRiskSufferedEntries.map((entry, idx) => (
                    <section
                      key={`foul-suffered-${entry.playerId ?? entry.playerName}-${idx}`}
                      className="space-y-3 rounded-xl border border-rose-500/20 bg-slate-950/70 p-4"
                    >
                      {(() => {
                        const rosterKey = `${entry.teamId}|${normalizePlayerName(entry.playerName)}`;
                        const m = selectedMetricsByRosterKey.get(rosterKey);
                        if (!m) return null;

                        const foulOu =
                          typeof m.oddsFoulsCommittedLine === "number"
                            ? ouPick(m.foulsCommittedLastFiveAvg, m.oddsFoulsCommittedLine)
                            : null;
                        const cardOu =
                          typeof m.oddsCardsLine === "number"
                            ? ouPick(predictedCardsFromMetric(m), m.oddsCardsLine)
                            : null;

                        if (!foulOu && !cardOu) return null;

                        return (
                          <p className="text-[11px] text-slate-400">
                            {foulOu ? (
                              <span className="mr-3">
                                Linea falli:{" "}
                                <span className="font-mono text-slate-200">
                                  {foulOu} {m.oddsFoulsCommittedLine?.toFixed(1)}
                                </span>{" "}
                                <span className="font-mono text-slate-500">
                                  (
                                  {formatOdds(
                                    foulOu === "Over" ? m.oddsFoulsCommittedOver : m.oddsFoulsCommittedUnder
                                  )}
                                  )
                                </span>
                              </span>
                            ) : null}
                            {cardOu ? (
                              <span className="mr-3">
                                Linea cartellino:{" "}
                                <span className="font-mono text-slate-200">
                                  {cardOu} {m.oddsCardsLine?.toFixed(1)}
                                </span>{" "}
                                <span className="font-mono text-slate-500">
                                  ({formatOdds(cardOu === "Over" ? m.oddsCardsOver : m.oddsCardsUnder)})
                                </span>
                              </span>
                            ) : null}
                            {m.oddsBookmaker ? (
                              <span className="text-slate-600">{m.oddsBookmaker}</span>
                            ) : null}
                          </p>
                        );
                      })()}
                      <p className="text-xs uppercase tracking-wide text-rose-200">
                        Rischio subiti — {idx + 1} · {entry.playerName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.team} · punteggio sintetico {entry.riskScore.toFixed(1)} · sovrapposizione massima ~{" "}
                        {entry.maxCollisionPercent}%
                      </p>
                      <div className="rounded-xl border border-emerald-500/25 bg-slate-950/80 p-4 shadow-inner">
                        <p className="mb-3 text-xs font-medium text-slate-400">
                          Heatmap: giocatore (A) e principali zone di pressione avversaria (B)
                        </p>
                        <FrictionPitchHeatmap {...entry.heatmap} />
                      </div>
                      <p className="rounded-xl border border-slate-600/50 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-200">
                        {entry.justification}
                      </p>
                      {entry.aggressors.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-400">
                          {entry.aggressors.map((a) => (
                            <li key={`${entry.playerName}-${a.playerName}`}>
                              <span className="font-medium text-slate-300">{a.playerName}</span> ({a.team}): collisione
                              ~{a.collisionPercent}% · falli commessi/stag. ~{a.foulsCommittedSeasonAvg.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  ))
                )
              ) : foulRiskCommittedEntries.length === 0 ? (
                <p className="text-sm text-amber-200">
                  Nessun giocatore supera le soglie con avversari che subiscono in media più di 1,00 falli a partita.
                </p>
              ) : (
                foulRiskCommittedEntries.map((entry, idx) => (
                  <section
                    key={`foul-committed-${entry.playerId ?? entry.playerName}-${idx}`}
                    className="space-y-3 rounded-xl border border-violet-500/20 bg-slate-950/70 p-4"
                  >
                    {(() => {
                      const rosterKey = `${entry.teamId}|${normalizePlayerName(entry.playerName)}`;
                      const m = selectedMetricsByRosterKey.get(rosterKey);
                      if (!m) return null;

                      const foulOu =
                        typeof m.oddsFoulsCommittedLine === "number"
                          ? ouPick(m.foulsCommittedLastFiveAvg, m.oddsFoulsCommittedLine)
                          : null;
                      const cardOu =
                        typeof m.oddsCardsLine === "number"
                          ? ouPick(predictedCardsFromMetric(m), m.oddsCardsLine)
                          : null;

                      if (!foulOu && !cardOu) return null;

                      return (
                        <p className="text-[11px] text-slate-400">
                          {foulOu ? (
                            <span className="mr-3">
                              Linea falli:{" "}
                              <span className="font-mono text-slate-200">
                                {foulOu} {m.oddsFoulsCommittedLine?.toFixed(1)}
                              </span>{" "}
                              <span className="font-mono text-slate-500">
                                ({formatOdds(foulOu === "Over" ? m.oddsFoulsCommittedOver : m.oddsFoulsCommittedUnder)})
                              </span>
                            </span>
                          ) : null}
                          {cardOu ? (
                            <span className="mr-3">
                              Linea cartellino:{" "}
                              <span className="font-mono text-slate-200">
                                {cardOu} {m.oddsCardsLine?.toFixed(1)}
                              </span>{" "}
                              <span className="font-mono text-slate-500">
                                ({formatOdds(cardOu === "Over" ? m.oddsCardsOver : m.oddsCardsUnder)})
                              </span>
                            </span>
                          ) : null}
                          {m.oddsBookmaker ? <span className="text-slate-600">{m.oddsBookmaker}</span> : null}
                        </p>
                      );
                    })()}
                    <p className="text-xs uppercase tracking-wide text-violet-200">
                      Rischio commessi — {idx + 1} · {entry.playerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {entry.team} · punteggio sintetico {entry.riskScore.toFixed(1)} · sovrapposizione massima ~{" "}
                      {entry.maxCollisionPercent}%
                    </p>
                    <div className="rounded-xl border border-emerald-500/25 bg-slate-950/80 p-4 shadow-inner">
                      <p className="mb-3 text-xs font-medium text-slate-400">
                        Heatmap: giocatore (A) e zone occupate dagli avversari più “tirati” (B)
                      </p>
                      <FrictionPitchHeatmap {...entry.heatmap} />
                    </div>
                    <p className="rounded-xl border border-slate-600/50 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-200">
                      {entry.justification}
                    </p>
                    {entry.aggressors.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-400">
                        {entry.aggressors.map((a) => (
                          <li key={`${entry.playerName}-${a.playerName}`}>
                            <span className="font-medium text-slate-300">{a.playerName}</span> ({a.team}): collisione
                            ~{a.collisionPercent}% · falli subiti/stag. ~{a.foulsSufferedSeasonAvg.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))
              )}

              {playerAnalyticsView === "PLAYER_FRICTION" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <TopPlayersSeasonTable
                    title="Top 5 Tiratori — Stagione"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.shotsSeasonAvg)}
                    onTopPlayersComputed={(top) =>
                      setSeasonShooterKeys(new Set(top.map((p) => playerStableKey(p))))
                    }
                  />
                  <TopPlayersLastTwoTable
                    title="Top 5 Tiratori — Ultimi 2"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.shotsLastTwoAvg)}
                    sampleCountSelector={(item) => item.shotsLastTwoSampleCount}
                    excludePlayers={seasonShooterKeys}
                  />
                  <TopPlayersSeasonTable
                    title="Portieri — Parate (stagione)"
                    rows={goalkeeperRows}
                    valueSelector={(item) => numeric(item.savesSeasonAvg)}
                  />
                  <TopPlayersSeasonTable
                    title="Top 5 Più Fallosi — Stagione"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.foulsCommittedSeasonAvg)}
                    onTopPlayersComputed={(top) =>
                      setSeasonFoulsCommittedKeys(new Set(top.map((p) => playerStableKey(p))))
                    }
                  />
                  <TopPlayersLastTwoTable
                    title="Top 5 Più Fallosi — Ultimi 2"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.foulsCommittedLastTwoAvg)}
                    sampleCountSelector={(item) => item.foulsCommittedLastTwoSampleCount}
                    excludePlayers={seasonFoulsCommittedKeys}
                  />
                  <TopPlayersSeasonTable
                    title="Top 5 Falli Subiti — Stagione"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.foulsSufferedSeasonAvg)}
                    onTopPlayersComputed={(top) =>
                      setSeasonFoulsSufferedKeys(new Set(top.map((p) => playerStableKey(p))))
                    }
                  />
                  <TopPlayersLastTwoTable
                    title="Top 5 Falli Subiti — Ultimi 2"
                    rows={playerRowsNoKeepers}
                    valueSelector={(item) => numeric(item.foulsSufferedLastTwoAvg)}
                    sampleCountSelector={(item) => item.foulsSufferedLastTwoSampleCount}
                    excludePlayers={seasonFoulsSufferedKeys}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
