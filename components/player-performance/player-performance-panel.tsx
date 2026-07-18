"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { isPlayerPerformanceAnchorStillUpcoming } from "@/lib/player-performance/fixture-eligibility";
import { buildMatchPlayerPerformanceQuery } from "@/lib/player-performance/hints";
import type { PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import {
  pickCategoryPlayers,
  sortCreators,
  sortOneVsOne,
  sortPlayersForMainTab
} from "@/lib/player-performance/selectors";
import type {
  MatchPlayerPerformance,
  PlayerPerformanceCategory,
  PlayerPerformanceItem
} from "@/lib/player-performance/types";
import {
  mainTabLabelIt,
  PLAYER_PERFORMANCE_TEXT
} from "@/lib/player-performance/text";
import { PlayerPerformanceCard } from "@/components/player-performance/player-performance-card";
import { PlayerPerformanceDetailModal } from "@/components/player-performance/player-performance-detail";
import { TeamOverviewSummary } from "@/components/player-performance/player-performance-overview-summary";

function PlayerPerformanceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-white/10" />
      <div className="h-4 w-full max-w-xl rounded bg-white/5" />
      <div className="flex gap-2">
        <div className="h-9 w-28 rounded-full bg-white/10" />
        <div className="h-9 w-24 rounded-full bg-white/10" />
        <div className="h-9 w-20 rounded-full bg-white/10" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((side) => (
          <div key={side} className="space-y-3">
            <div className="h-4 w-32 rounded bg-white/10" />
            {[0, 1, 2].map((card) => (
              <div key={card} className="h-32 rounded-2xl border border-white/10 bg-slate-950/50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamPlayerList({
  teamName,
  players,
  mainTab,
  category,
  emptyLabel,
  expanded,
  onToggleExpand,
  canExpand,
  onSelectPlayer
}: {
  teamName: string;
  players: PlayerPerformanceItem[];
  mainTab: PlayerPerformanceMainTab;
  category: PlayerPerformanceCategory;
  emptyLabel: string;
  expanded: boolean;
  onToggleExpand: () => void;
  canExpand: boolean;
  onSelectPlayer: (item: PlayerPerformanceItem) => void;
}) {
  const visible = expanded
    ? players
    : players.slice(0, PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold uppercase tracking-wide text-cyan-200">{teamName}</h4>
      {visible.length ? (
        visible.map((item) => (
          <PlayerPerformanceCard
            key={`${teamName}-${item.playerId}-${mainTab}-${category}`}
            item={item}
            mainTab={mainTab}
            category={category}
            onSelect={onSelectPlayer}
          />
        ))
      ) : (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      )}
      {canExpand ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-sm font-bold text-cyan-200 hover:text-cyan-100"
        >
          {expanded ? PLAYER_PERFORMANCE_TEXT.seeLess : PLAYER_PERFORMANCE_TEXT.seeAll}
        </button>
      ) : null}
    </div>
  );
}

export function PlayerPerformancePanel({
  eventId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  startTimestamp
}: {
  eventId: number;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  startTimestamp?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchPlayerPerformance | null>(null);
  const [mainTab, setMainTab] = useState<PlayerPerformanceMainTab>("overview");
  const [category, setCategory] = useState<PlayerPerformanceCategory>("dangerous");
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPerformanceItem | null>(null);
  const [selectedIsHome, setSelectedIsHome] = useState(true);
  const [expandedSides, setExpandedSides] = useState<Record<"homeTeam" | "awayTeam", boolean>>({
    homeTeam: false,
    awayTeam: false
  });

  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const matchStillUpcoming = useMemo(() => {
    void timeTick;
    if (!startTimestamp || startTimestamp <= 0) return true;
    return isPlayerPerformanceAnchorStillUpcoming({
      fixtureId: eventId,
      kickoffTimestamp: startTimestamp
    });
  }, [eventId, startTimestamp, timeTick]);

  useEffect(() => {
    if (!matchStillUpcoming) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query =
          homeTeamId && awayTeamId
            ? `?${buildMatchPlayerPerformanceQuery({
                homeTeamId,
                awayTeamId,
                homeTeamName,
                awayTeamName,
                startTimestamp
              })}`
            : "";
        const res = await fetch(`/api/match-player-performance/${eventId}${query}`, {
          cache: "no-store"
        });
        if (res.status === 410) {
          if (!cancelled) {
            setError(PLAYER_PERFORMANCE_TEXT.matchAlreadyStarted);
            setData(null);
          }
          return;
        }
        if (res.status === 404) {
          if (!cancelled) {
            setError(PLAYER_PERFORMANCE_TEXT.notReady);
            setData(null);
          }
          return;
        }
        if (!res.ok) throw new Error("player_performance_fetch_failed");
        const json = (await res.json()) as MatchPlayerPerformance;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setError(PLAYER_PERFORMANCE_TEXT.error);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, startTimestamp, matchStillUpcoming]);

  useEffect(() => {
    setExpandedSides({ homeTeam: false, awayTeam: false });
  }, [mainTab, category, eventId]);

  useEffect(() => {
    if (mainTab === "creation") setCategory("dangerous");
    else if (mainTab === "overview") setCategory("dangerous");
  }, [mainTab]);

  const emptyLabel = useMemo(() => {
    if (data?.warnings.includes(PLAYER_PERFORMANCE_TEXT.insufficientData)) {
      return PLAYER_PERFORMANCE_TEXT.insufficientData;
    }
    if (mainTab === "shooting") return PLAYER_PERFORMANCE_TEXT.emptyShooting;
    if (mainTab === "creation") return PLAYER_PERFORMANCE_TEXT.emptyCreation;
    if (mainTab === "trends") return PLAYER_PERFORMANCE_TEXT.emptyTrends;
    return PLAYER_PERFORMANCE_TEXT.emptyCategory;
  }, [data?.warnings, mainTab]);

  const selectPlayer = (item: PlayerPerformanceItem, isHome: boolean) => {
    setSelectedPlayer(item);
    setSelectedIsHome(isHome);
  };

  if (!matchStillUpcoming) {
    return <p className="text-sm text-slate-400">{PLAYER_PERFORMANCE_TEXT.matchAlreadyStarted}</p>;
  }

  if (loading) return <PlayerPerformanceSkeleton />;
  if (error || !data) {
    return <p className="text-sm text-rose-300">{error ?? PLAYER_PERFORMANCE_TEXT.error}</p>;
  }

  const mainTabs: PlayerPerformanceMainTab[] = ["overview", "shooting", "creation", "trends"];
  const categoryTabs: Array<{ id: PlayerPerformanceCategory; label: string }> = [
    { id: "dangerous", label: PLAYER_PERFORMANCE_TEXT.tabs.dangerous },
    { id: "rising", label: PLAYER_PERFORMANCE_TEXT.tabs.rising },
    { id: "declining", label: PLAYER_PERFORMANCE_TEXT.tabs.declining }
  ];

  const pickPlayers = (side: "homeTeam" | "awayTeam") => {
    const team = data[side];
    if (mainTab === "overview") return pickCategoryPlayers(team, category);
    if (mainTab === "creation") {
      return category === "dangerous"
        ? sortCreators(team.allPlayers)
        : sortOneVsOne(team.allPlayers);
    }
    return sortPlayersForMainTab(team.allPlayers, mainTab);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2">
          <h3 className="text-xl font-bold text-white">{PLAYER_PERFORMANCE_TEXT.title}</h3>
          <button
            type="button"
            onClick={() => setShowTooltip((open) => !open)}
            className="mt-0.5 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-cyan-200"
            aria-label={PLAYER_PERFORMANCE_TEXT.tooltipTitle}
            aria-expanded={showTooltip}
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">{PLAYER_PERFORMANCE_TEXT.subtitle}</p>
        {showTooltip ? (
          <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-400">
            <p>{PLAYER_PERFORMANCE_TEXT.tooltip}</p>
            <p>{PLAYER_PERFORMANCE_TEXT.tooltips.dangerIndex}</p>
            <p>{PLAYER_PERFORMANCE_TEXT.tooltips.shotThreatIndex}</p>
            <p>{PLAYER_PERFORMANCE_TEXT.tooltips.creatorIndex}</p>
            <p>{PLAYER_PERFORMANCE_TEXT.tooltips.consistencyScore}</p>
          </div>
        ) : null}
      </div>

      {data.warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-200/90">
          {warning}
        </p>
      ))}

      <div className="flex flex-wrap gap-2">
        {mainTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMainTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              mainTab === tab
                ? "bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/30"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {mainTabLabelIt(tab)}
          </button>
        ))}
      </div>

      {mainTab === "overview" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <TeamOverviewSummary
              teamName={data.homeTeam.teamName}
              overview={data.homeTeam.overview}
              onSelectPlayer={(item) => selectPlayer(item, true)}
            />
            <TeamOverviewSummary
              teamName={data.awayTeam.teamName}
              overview={data.awayTeam.overview}
              onSelectPlayer={(item) => selectPlayer(item, false)}
            />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">
              {PLAYER_PERFORMANCE_TEXT.overview.rankingsTitle}
            </h4>
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    category === tab.id
                      ? "bg-white/10 text-white ring-1 ring-white/20"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{PLAYER_PERFORMANCE_TEXT.compareHint}</p>
          </div>
        </>
      ) : null}

      {mainTab === "creation" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("dangerous")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              category === "dangerous"
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {PLAYER_PERFORMANCE_TEXT.sections.creativeThreat}
          </button>
          <button
            type="button"
            onClick={() => setCategory("rising")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              category === "rising"
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {PLAYER_PERFORMANCE_TEXT.sections.oneVsOneThreat}
          </button>
        </div>
      ) : null}

      {mainTab === "trends" ? (
        <p className="text-xs text-slate-500">{PLAYER_PERFORMANCE_TEXT.compareHint}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {(["homeTeam", "awayTeam"] as const).map((side) => {
          const players = pickPlayers(side);
          return (
            <TeamPlayerList
              key={side}
              teamName={data[side].teamName}
              players={players}
              mainTab={mainTab}
              category={mainTab === "creation" ? (category === "dangerous" ? "dangerous" : "rising") : category}
              emptyLabel={emptyLabel}
              expanded={expandedSides[side]}
              onToggleExpand={() =>
                setExpandedSides((current) => ({ ...current, [side]: !current[side] }))
              }
              canExpand={players.length > PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory}
              onSelectPlayer={(item) => selectPlayer(item, side === "homeTeam")}
            />
          );
        })}
      </div>

      <PlayerPerformanceDetailModal
        player={selectedPlayer}
        isHomeTeam={selectedIsHome}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
