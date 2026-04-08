"use client";

import { useEffect, useMemo, useState } from "react";
import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import type { CompetitionScope, TacticalMetrics, TeamPerformanceBlueprint } from "@/lib/types";

type KioskView = "MATCH_TEAMS" | "PLAYER_FRICTION";
type TeamStatView = "OFFENSE" | "DEFENSE";

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
  /** `full`: sempre stats giocatori + heatmap. `serie_a_players`: pieno per Serie A, Champions ed Europa; solo squadra per Serie B e altre leghe del menu. */
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

interface MappingDiagnosticRow {
  metricId: string;
  label: string;
  candidates: string[];
  matchedKey: string | null;
  homeValue: number;
  awayValue: number;
  source: "provider_key" | "derived";
}

interface MatchInsightsDiagnostics {
  source: "event_statistics" | "event_statistics_recent" | "model_fallback";
  eventId: number | null;
  availableKeys: string[];
  offensive: MappingDiagnosticRow[];
  defensive: MappingDiagnosticRow[];
  goalkeeperSaves?: Array<{
    playerName: string;
    teamId: number;
    teamName: string;
    role: string;
    savesSeasonAvg: number;
    savesSeasonSampleCount: number;
    savesLastTwoAvg: number;
    savesLastTwoSampleCount: number;
    source: "season_event_series" | "overall_fallback" | "aggregate_event_series";
  }>;
}

interface TeamBlueprintDebugMeta {
  source:
    | "cache_recent"
    | "cache_no_upcoming_match"
    | "cache_budget_block"
    | "season_overall_direct_context"
    | "season_overall_from_event_context"
    | "event_statistics_fallback";
  tournamentId?: number;
  seasonId?: number;
  cacheLastUpdated?: string;
}

type StandingsRow = {
  position: number;
  teamId: number;
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

const OFFENSE_KEYS: Array<[keyof TeamPerformanceBlueprint["offensive"], string]> = [
  ["goalsArea", "Tiri in Area"],
  ["goalsOutside", "Tiri Fuori Area"],
  ["goalsLeft", "Goal Sinistro"],
  ["goalsRight", "Goal Destro"],
  ["goalsHead", "Goal Testa"],
  ["bigChancesCreated", "Occasioni Create"],
  ["bigChancesMissed", "Occasioni Mancate"],
  ["shotsOn", "Tiri in Porta"],
  ["shotsOff", "Tiri Fuori"],
  ["shotsBlocked", "Tiri Respinti"],
  ["dribbles", "Dribbling"],
  ["corners", "Corner"],
  ["freeKicksGoals", "Punizioni Goal"],
  ["freeKicksTotal", "Punizioni Tot"],
  ["penaltiesScored", "Rigori Segnati"],
  ["penaltiesTotal", "Rigori Tot"],
  ["counterattacks", "Contropiedi"],
  ["offsides", "Fuorigioco"],
  ["woodwork", "Pali/Traverse"]
];

const DEFENSE_KEYS: Array<[keyof TeamPerformanceBlueprint["defensive"], string]> = [
  ["cleanSheets", "Porte Inviolate"],
  ["goalsConceded", "Goal Subiti"],
  ["tackles", "Contrasti"],
  ["interceptions", "Intercetti"],
  ["clearances", "Rinvii"],
  ["recoveries", "Recuperi"],
  ["errorsToShot", "Errori -> Tiro"],
  ["errorsToGoal", "Errori -> Goal"],
  ["penaltiesConceded", "Rigori Commessi"],
  ["goalLineClearances", "Salvataggi sulla Linea"],
  ["lastManFoul", "Fallo ultimo uomo"],
  ["foulsCommitted", "Falli Fatti"],
  ["yellowCards", "Gialli"],
  ["redCards", "Rossi"]
];

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

function TeamStatsPanel({
  title,
  blueprint,
  mode,
  emptyHint
}: {
  title: string;
  blueprint: TeamPerformanceBlueprint | null;
  mode: TeamStatView;
  /** Messaggio se non c’è ancora un blueprint (evita la griglia tutta 0,00). */
  emptyHint?: string;
}) {
  const rows = mode === "OFFENSE" ? OFFENSE_KEYS : DEFENSE_KEYS;

  if (!blueprint) {
    return (
      <article className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-200">{title}</h3>
        <p className="text-sm text-slate-400">
          {emptyHint ??
            "Nessun dato squadra disponibile. Seleziona una partita dalla lista sopra oppure attendi il caricamento."}
        </p>
      </article>
    );
  }

  const data =
    mode === "OFFENSE"
      ? (blueprint.offensive as unknown as Record<string, number>)
      : (blueprint.defensive as unknown as Record<string, number>);

  return (
    <article className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-200">{title}</h3>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Valori medi per partita</p>
      <div className="space-y-1 text-sm">
        {rows.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-slate-800 py-1">
            <span className="text-slate-300">{label}</span>
            <span className="font-semibold text-cyan-100">{formatStat(data[key])}</span>
          </div>
        ))}
      </div>
    </article>
  );
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
    playerAnalyticsPolicy = "full",
    kioskTitle = "Kiosk Tactical Menu",
    kioskDescription,
    testingMatch,
    presetMatch
  } = props;
  const [view, setView] = useState<KioskView>("MATCH_TEAMS");
  const [metrics, setMetrics] = useState<TacticalMetrics[]>(initialMetrics);
  const [playerDetailLevel, setPlayerDetailLevel] = useState<"full" | "team_only">("full");

  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  /** Aggiornato ogni minuto: ricalcola il filtro “solo future” senza nuove richieste API. */
  const [matchListTimeTick, setMatchListTimeTick] = useState(0);
  const [selectedCompetition, setSelectedCompetition] = useState<string>("ALL");
  const [selectedMatchId, setSelectedMatchId] = useState<number>(0);
  const [teamMode, setTeamMode] = useState<TeamStatView>("OFFENSE");
  const [homeBlueprint, setHomeBlueprint] = useState<TeamPerformanceBlueprint | null>(null);
  const [awayBlueprint, setAwayBlueprint] = useState<TeamPerformanceBlueprint | null>(null);
  const [loadingTeamStats, setLoadingTeamStats] = useState(false);
  const [teamStatsError, setTeamStatsError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<MatchInsightsDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [seasonShooterKeys, setSeasonShooterKeys] = useState<Set<string>>(new Set());
  const [seasonFoulsCommittedKeys, setSeasonFoulsCommittedKeys] = useState<Set<string>>(new Set());
  const [seasonFoulsSufferedKeys, setSeasonFoulsSufferedKeys] = useState<Set<string>>(new Set());
  const [standingsRows, setStandingsRows] = useState<StandingsRow[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [blueprintDebug, setBlueprintDebug] = useState<{
    home?: TeamBlueprintDebugMeta;
    away?: TeamBlueprintDebugMeta;
  } | null>(null);

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
    const out: Array<{ left: TacticalMetrics; right: TacticalMetrics; pairPriority: number }> = [];
    for (const pair of sorted) {
      if (out.length >= 2) break;
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
    if (!selectedMatch) {
      setHomeBlueprint(null);
      setAwayBlueprint(null);
      setDiagnostics(null);
      setBlueprintDebug(null);
      setMetrics([]);
      setPlayerDetailLevel("full");
      setStandingsRows([]);
      setStandingsLoading(false);
      setStandingsError(null);
      return;
    }

    const scope = scopeFromCompetitionSlug(selectedMatch.competitionSlug);
    let cancelled = false;
    const abort = new AbortController();

    async function loadTeamStats() {
      setLoadingTeamStats(true);
      setTeamStatsError(null);

      const testingForceRefresh = testingMatch || presetMatch ? "&forceRefresh=1" : "";
      const playerAnalyticsParam =
        playerAnalyticsPolicy === "serie_a_players" ? "&playerAnalytics=serie_a_players" : "";
      try {
        const response = await fetch(
          `/api/tactical/match-insights?eventId=${selectedMatch.eventId}&homeTeamId=${selectedMatch.homeTeam.id}&awayTeamId=${selectedMatch.awayTeam.id}&homeTeamName=${encodeURIComponent(
            selectedMatch.homeTeam.name
          )}&awayTeamName=${encodeURIComponent(
            selectedMatch.awayTeam.name
          )}&competitionSlug=${encodeURIComponent(selectedMatch.competitionSlug)}&scope=${scope}${
            showDiagnostics ? "&diagnostics=1" : ""
          }${testingForceRefresh}${playerAnalyticsParam}`,
          { cache: "no-store", signal: abort.signal }
        );

        if (!response.ok) {
          if (!cancelled) {
            setTeamStatsError("Statistiche squadre non disponibili per questo match.");
            setLoadingTeamStats(false);
          }
          return;
        }

        const json = (await response.json()) as {
          metrics?: TacticalMetrics[];
          homeBlueprint?: TeamPerformanceBlueprint;
          awayBlueprint?: TeamPerformanceBlueprint;
          playerDetailLevel?: "full" | "team_only";
          diagnostics?: MatchInsightsDiagnostics | null;
          blueprintDebug?: {
            home?: TeamBlueprintDebugMeta;
            away?: TeamBlueprintDebugMeta;
          };
        };

        if (!cancelled) {
          setHomeBlueprint(json.homeBlueprint ?? null);
          setAwayBlueprint(json.awayBlueprint ?? null);
          setDiagnostics(json.diagnostics ?? null);
          setBlueprintDebug(json.blueprintDebug ?? null);
          setMetrics(Array.isArray(json.metrics) ? json.metrics : []);
          setPlayerDetailLevel(json.playerDetailLevel === "team_only" ? "team_only" : "full");
          setLoadingTeamStats(false);
        }
      } catch {
        if (abort.signal.aborted) return;
        if (!cancelled) {
          setTeamStatsError("Statistiche squadre non disponibili per questo match.");
          setLoadingTeamStats(false);
        }
      }
    }

    void loadTeamStats();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [selectedMatch, showDiagnostics, playerAnalyticsPolicy, testingMatch, presetMatch]);

  useEffect(() => {
    if (view !== "MATCH_TEAMS") return;
    if (!selectedMatch) return;
    const tournamentId = blueprintDebug?.home?.tournamentId ?? blueprintDebug?.away?.tournamentId ?? 0;
    const seasonId = blueprintDebug?.home?.seasonId ?? blueprintDebug?.away?.seasonId ?? 0;
    if (!tournamentId || !seasonId) {
      setStandingsRows([]);
      setStandingsError(null);
      setStandingsLoading(false);
      return;
    }

    let cancelled = false;
    const abort = new AbortController();
    async function loadStandings() {
      setStandingsLoading(true);
      setStandingsError(null);
      try {
        const res = await fetch(
          `/api/tactical/standings?tournamentId=${tournamentId}&seasonId=${seasonId}&mode=total`,
          { cache: "no-store", signal: abort.signal }
        );
        if (!res.ok) {
          if (!cancelled) {
            setStandingsRows([]);
            setStandingsError("Classifica non disponibile per questa competizione.");
            setStandingsLoading(false);
          }
          return;
        }
        const json = (await res.json()) as { rows?: StandingsRow[] };
        if (!cancelled) {
          setStandingsRows(Array.isArray(json.rows) ? json.rows : []);
          setStandingsError(null);
          setStandingsLoading(false);
        }
      } catch {
        if (abort.signal.aborted) return;
        if (!cancelled) {
          setStandingsRows([]);
          setStandingsError("Classifica non disponibile per questa competizione.");
          setStandingsLoading(false);
        }
      }
    }

    void loadStandings();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [view, selectedMatch, blueprintDebug?.home?.tournamentId, blueprintDebug?.home?.seasonId, blueprintDebug?.away?.tournamentId, blueprintDebug?.away?.seasonId]);

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
            onClick={() => setView("MATCH_TEAMS")}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide ${
              view === "MATCH_TEAMS"
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            Match Teams
          </button>
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
        </div>
      </header>

      {view === "MATCH_TEAMS" ? (
        <div className="space-y-4">
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
              caricare le statistiche squadra.
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTeamMode("OFFENSE")}
              className={`rounded-lg border px-3 py-2 text-xs ${
                teamMode === "OFFENSE"
                  ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              Attacco
            </button>
            <button
              type="button"
              onClick={() => setTeamMode("DEFENSE")}
              className={`rounded-lg border px-3 py-2 text-xs ${
                teamMode === "DEFENSE"
                  ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              Difesa
            </button>
            <button
              type="button"
              onClick={() => setShowDiagnostics((prev) => !prev)}
              className={`rounded-lg border px-3 py-2 text-xs ${
                showDiagnostics
                  ? "border-amber-300 bg-amber-400/20 text-amber-100"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              Mapping Debug
            </button>
          </div>

          {loadingTeamStats && selectedMatch ? (
            <p className="text-sm text-slate-400">Caricamento statistiche squadre...</p>
          ) : null}
          {teamStatsError ? <p className="text-sm text-rose-300">{teamStatsError}</p> : null}
          {playerDetailLevel === "team_only" ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Per questa competizione sono mostrate solo le <strong>statistiche di squadra</strong> (es.{" "}
              <strong>Serie B</strong>). Analisi giocatori e heatmap: <strong>Serie A</strong>,{" "}
              <strong>Champions League</strong> e <strong>Europa League</strong>.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <TeamStatsPanel
              title={selectedMatch?.homeTeam.name ?? "Casa"}
              blueprint={homeBlueprint}
              mode={teamMode}
              emptyHint={
                loadingTeamStats && selectedMatch
                  ? "Caricamento in corso…"
                  : teamStatsError
                    ? "Caricamento non riuscito. Verifica la risposta dell’API o riprova."
                    : selectedMatch
                      ? undefined
                      : "Seleziona prima una partita dall’elenco sopra."
              }
            />
            <TeamStatsPanel
              title={selectedMatch?.awayTeam.name ?? "Ospiti"}
              blueprint={awayBlueprint}
              mode={teamMode}
              emptyHint={
                loadingTeamStats && selectedMatch
                  ? "Caricamento in corso…"
                  : teamStatsError
                    ? "Caricamento non riuscito. Verifica la risposta dell’API o riprova."
                    : selectedMatch
                      ? undefined
                      : "Seleziona prima una partita dall’elenco sopra."
              }
            />
          </div>

          {blueprintDebug ? (
            <div className="rounded-lg border border-cyan-400/20 bg-slate-950/50 p-3 text-xs text-slate-300">
              <p className="mb-2 uppercase tracking-wide text-cyan-300">Blueprint Source Debug</p>
              <p>
                {selectedMatch?.homeTeam.name ?? "Home"}: {blueprintDebug.home?.source ?? "n/a"}
                {blueprintDebug.home?.seasonId
                  ? ` | season ${blueprintDebug.home.seasonId}`
                  : ""}
                {blueprintDebug.home?.tournamentId
                  ? ` | tournament ${blueprintDebug.home.tournamentId}`
                  : ""}
                {blueprintDebug.home?.cacheLastUpdated
                  ? ` | cache ${blueprintDebug.home.cacheLastUpdated}`
                  : ""}
              </p>
              <p>
                {selectedMatch?.awayTeam.name ?? "Away"}: {blueprintDebug.away?.source ?? "n/a"}
                {blueprintDebug.away?.seasonId
                  ? ` | season ${blueprintDebug.away.seasonId}`
                  : ""}
                {blueprintDebug.away?.tournamentId
                  ? ` | tournament ${blueprintDebug.away.tournamentId}`
                  : ""}
                {blueprintDebug.away?.cacheLastUpdated
                  ? ` | cache ${blueprintDebug.away.cacheLastUpdated}`
                  : ""}
              </p>
            </div>
          ) : null}

          {showDiagnostics && diagnostics ? (
            <article className="rounded-xl border border-amber-400/30 bg-slate-950/70 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
                  Mapping Diagnostica Provider
                </h3>
                <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                  Source: {diagnostics.source}
                </span>
                {diagnostics.eventId ? (
                  <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                    Event: {diagnostics.eventId}
                  </span>
                ) : null}
              </div>

              {diagnostics.source === "model_fallback" ? (
                <p className="text-xs text-amber-200">
                  Statistiche evento non disponibili dal provider per questo match: blueprint mostrato in fallback.
                </p>
              ) : null}
              {diagnostics.source === "event_statistics_recent" ? (
                <p className="text-xs text-amber-200">
                  Match selezionato senza statistiche complete: mapping derivato da una partita recente conclusa della stessa squadra/competizione.
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Chiavi provider trovate ({diagnostics.availableKeys.length})
                </p>
                <p className="rounded-md border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-300">
                  {diagnostics.availableKeys.length > 0
                    ? diagnostics.availableKeys.join(", ")
                    : "Nessuna chiave disponibile."}
                </p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {[
                  { title: "Attacco", rows: diagnostics.offensive },
                  { title: "Difesa", rows: diagnostics.defensive }
                ].map((group) => (
                  <div key={group.title} className="rounded-lg border border-slate-800 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {group.title}
                    </p>
                    <div className="space-y-1 text-xs">
                      {group.rows.map((row) => (
                        <div
                          key={`${group.title}-${row.metricId}`}
                          className="rounded border border-slate-800 bg-slate-900/50 p-2"
                        >
                          <p className="font-semibold text-slate-100">{row.label}</p>
                          <p className="text-slate-400">
                            match key:{" "}
                            <span className={row.matchedKey ? "text-emerald-300" : "text-rose-300"}>
                              {row.matchedKey ?? "NON TROVATA"}
                            </span>
                          </p>
                          <p className="text-slate-400">
                            tentativi:{" "}
                            <span className="text-slate-300">
                              {row.candidates.length ? row.candidates.join(" | ") : "derivato"}
                            </span>
                          </p>
                          <p className="text-slate-400">
                            {selectedMatch?.homeTeam.name ?? "Home"}:{" "}
                            <span className="text-cyan-100">{formatStat(row.homeValue)}</span> -{" "}
                            {selectedMatch?.awayTeam.name ?? "Away"}:{" "}
                            <span className="text-cyan-100">{formatStat(row.awayValue)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {diagnostics.goalkeeperSaves && diagnostics.goalkeeperSaves.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-800 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
                    Diagnostica Portieri - Parate Stagione
                  </p>
                  <div className="space-y-1 text-xs">
                    {diagnostics.goalkeeperSaves.map((row) => (
                      <div
                        key={`${row.teamId}-${row.playerName}`}
                        className="rounded border border-slate-800 bg-slate-900/50 p-2"
                      >
                        <p className="font-semibold text-slate-100">
                          {row.playerName} ({row.teamName})
                        </p>
                        <p className="text-slate-400">
                          media stagione: <span className="text-cyan-100">{formatStat(row.savesSeasonAvg)}</span> -
                          campioni stagione:{" "}
                          <span className="text-cyan-100">{row.savesSeasonSampleCount}</span>
                        </p>
                        <p className="text-slate-400">
                          media ultimi 2: <span className="text-cyan-100">{formatStat(row.savesLastTwoAvg)}</span> -
                          campioni ultimi 2:{" "}
                          <span className="text-cyan-100">{row.savesLastTwoSampleCount}</span>
                        </p>
                        <p className="text-slate-400">
                          sorgente:{" "}
                          <span className="text-emerald-300">
                            {row.source === "season_event_series"
                              ? "eventi stagione"
                              : row.source === "aggregate_event_series"
                                ? "eventi stagione (aggregate mode)"
                                : "fallback overall"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}

          <article className="rounded-xl border border-emerald-400/20 bg-slate-950/70 p-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-emerald-200">
              Classifica competizione
            </h3>
            <p className="mb-3 text-[11px] text-slate-500">Totale (punti, W-D-L, GF/GS). Evidenziate le squadre del match.</p>
            {standingsLoading ? (
              <p className="text-sm text-slate-400">Caricamento classifica...</p>
            ) : standingsError ? (
              <p className="text-sm text-rose-300">{standingsError}</p>
            ) : standingsRows.length === 0 ? (
              <p className="text-sm text-slate-400">Classifica non disponibile.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-800">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-900/95 text-slate-300">
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Squadra</th>
                      <th className="px-2 py-2 font-semibold">G</th>
                      <th className="px-2 py-2 font-semibold">V</th>
                      <th className="px-2 py-2 font-semibold">N</th>
                      <th className="px-2 py-2 font-semibold">P</th>
                      <th className="px-2 py-2 font-semibold">GF</th>
                      <th className="px-2 py-2 font-semibold">GS</th>
                      <th className="px-2 py-2 font-semibold">PT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsRows.map((row) => {
                      const isHome = row.teamId === selectedMatch?.homeTeam.id;
                      const isAway = row.teamId === selectedMatch?.awayTeam.id;
                      const highlight = isHome || isAway;
                      return (
                        <tr
                          key={`${row.position}-${row.teamId}`}
                          className={`border-b border-slate-800/80 ${highlight ? "bg-emerald-500/10" : ""}`}
                        >
                          <td className="px-2 py-2 font-semibold text-slate-100">{row.position}</td>
                          <td className="px-2 py-2 text-slate-100">
                            {row.teamName}
                            {isHome ? " (Casa)" : isAway ? " (Ospiti)" : ""}
                          </td>
                          <td className="px-2 py-2 text-slate-300">{row.matches}</td>
                          <td className="px-2 py-2 text-slate-300">{row.wins}</td>
                          <td className="px-2 py-2 text-slate-300">{row.draws}</td>
                          <td className="px-2 py-2 text-slate-300">{row.losses}</td>
                          <td className="px-2 py-2 text-slate-300">{row.goalsFor}</td>
                          <td className="px-2 py-2 text-slate-300">{row.goalsAgainst}</td>
                          <td className="px-2 py-2 font-semibold text-emerald-100">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      ) : null}

      {view === "PLAYER_FRICTION" ? (
        <div className="space-y-4">
          {playerDetailLevel === "team_only" ? (
            <div className="rounded-xl border border-slate-600 bg-slate-950/70 p-6 text-center">
              <p className="text-base text-slate-200">
                Per questa lega il kiosk mostra <strong>solo le statistiche delle squadre</strong> (tab Match Teams).
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Classifiche giocatori, scontri in campo e mappe non sono caricati per le altre competizioni del menu,
                per limitare le chiamate API (restano attivi per Serie A, Champions ed Europa League; Serie B solo
                squadra).
              </p>
            </div>
          ) : (
            <>
          <p className="text-sm text-slate-300">
            Fino a due possibili scontri tra giocatori avversari, con mappa del campo e numeri sui falli (media
            campionato).
          </p>

          <div className="grid gap-2 lg:grid-cols-2">
            {visibleMatches.map((match) => (
              <button
                key={`friction-${match.eventId}`}
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
              </button>
            ))}
          </div>

          {matchFrictionPairs.length === 0 ? (
            <p className="text-sm text-amber-200">
              Per questa partita non risultano scontri tra giocatori particolarmente evidenti.
            </p>
          ) : null}
          {matchFrictionPairs.map((pair, idx) => (
            <section key={`${pair.left.playerName}-${pair.right.playerName}-${idx}`} className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-cyan-300">Possibile scontro {idx + 1}</p>
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
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
