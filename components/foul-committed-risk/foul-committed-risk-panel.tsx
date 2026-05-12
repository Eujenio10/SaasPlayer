"use client";

import { useEffect, useMemo, useState } from "react";
import type { FoulRiskEntry } from "@/lib/foul-risk-analysis";
import type { TacticalMetrics } from "@/lib/types";
import type { UserAccessSummary } from "@/lib/auth/user-access";
import { RiskCommittedSidebar } from "./risk-committed-sidebar";
import { CommittedRiskInfoBox } from "./info-box";
import { FoulCommittedFilterBar, committedFilterRows } from "./foul-committed-filter-bar";
import { CommittedRiskFooterBar } from "./footer-info-bar";
import { RiskCommittedRow, buildOuBlocks } from "./risk-committed-row";
import { resolveAggressorMetric } from "./resolve-aggressor-metric";

interface UpcomingMatchItem {
  eventId: number;
  competitionSlug: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
}

function kioskPathFromFixtureId(fixtureId: string): string {
  if (fixtureId === "kiosk-hybrid") return "/kiosk/hybrid";
  if (fixtureId === "kiosk-testing") return "/kiosk-testing";
  return "/kiosk";
}

function displayLastUpdated(metrics: TacticalMetrics[]): string {
  let best = -Infinity;
  for (const m of metrics) {
    const t = Date.parse(m.lastUpdated);
    if (Number.isFinite(t) && t > best) best = t;
  }
  if (!Number.isFinite(best) || best < 0) return "—";
  return new Date(best).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function FoulCommittedRiskPanel({
  fixtureId,
  entries,
  selectedMatch,
  selectedMatchMetrics,
  selectedMetricsByRosterKey,
  leagueFilterSlugs,
  selectedCompetitionNormalized,
  onSelectCompetitionSlug,
  competitionLabel,
  accessSummary,
  normalizePlayerName,
  simpleLevelFromScore,
  onOpenSufferedView
}: {
  fixtureId: string;
  entries: FoulRiskEntry[];
  selectedMatch: UpcomingMatchItem | null;
  selectedMatchMetrics: TacticalMetrics[];
  selectedMetricsByRosterKey: Map<string, TacticalMetrics>;
  leagueFilterSlugs: string[];
  selectedCompetitionNormalized: string;
  onSelectCompetitionSlug: (slug: string) => void;
  competitionLabel: (slug: string) => string;
  accessSummary: UserAccessSummary;
  normalizePlayerName: (name: string) => string;
  simpleLevelFromScore: (score: number) => string;
  onOpenSufferedView: () => void;
}) {
  const kioskHref = kioskPathFromFixtureId(fixtureId);

  const [teamScope, setTeamScope] = useState<"all" | "home" | "away">("all");
  const [playerKey, setPlayerKey] = useState("");

  useEffect(() => {
    setTeamScope("all");
    setPlayerKey("");
  }, [selectedMatch?.eventId]);

  useEffect(() => {
    setPlayerKey("");
  }, [teamScope]);

  const filtered = useMemo(
    () =>
      committedFilterRows(entries, {
        teamScope,
        playerKey,
        match: selectedMatch
      }),
    [entries, teamScope, playerKey, selectedMatch]
  );

  const lastUpdatedDisplay = useMemo(
    () => displayLastUpdated(selectedMatchMetrics),
    [selectedMatchMetrics]
  );

  return (
    <div
      className="rounded-[1.75rem] border border-[rgba(120,170,255,0.12)] bg-gradient-to-b from-[#07111F] to-[#040B14] p-3 shadow-[0_24px_70px_rgba(2,8,22,0.55)] sm:p-5"
      id="rischio-falli-commessi"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <RiskCommittedSidebar kioskHref={kioskHref} onOpenSuffered={onOpenSufferedView} />

        <div className="min-w-0 flex-1 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Rischio falli commessi</h2>
                {!accessSummary.isMember ? (
                  <span className="rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-100 ring-1 ring-amber-400/35">
                    Abbonamento attivo
                  </span>
                ) : (
                  <span className="rounded-full border border-cyan-300/22 bg-cyan-300/12 px-3 py-1 text-[11px] font-bold text-cyan-100">
                    Piano membri — {accessSummary.matchUsage.used}/
                    {accessSummary.matchUsage.limit ?? 3} partite
                  </span>
                )}
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(120,170,255,0.2)] bg-[rgba(8,16,32,0.85)] text-slate-300"
                  aria-hidden
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
                  </svg>
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400 sm:text-base">
                Valutiamo il rischio che un giocatore commetta fallo basandoci sulla media dei falli subiti dagli
                avversari con cui ha più probabilità di confronto, calcolata tramite heatmap.
              </p>
            </div>
            <CommittedRiskInfoBox />
          </div>

          <FoulCommittedFilterBar
            entries={entries}
            leagueSlugs={leagueFilterSlugs}
            selectedLeagueNormalized={selectedCompetitionNormalized}
            onSelectLeague={onSelectCompetitionSlug}
            leagueLabelFn={competitionLabel}
            selectedMatch={selectedMatch}
            teamScope={teamScope}
            onTeamScopeChange={setTeamScope}
            playerKey={playerKey}
            onPlayerKeyChange={setPlayerKey}
          />

          {entries.length === 0 ? (
            <p className="rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.55)] px-4 py-6 text-sm text-amber-200">
              Nessun giocatore raggiunge la soglia minima di segnale combinando posizione prevista, marcatura probabile
              e falli subiti dall&apos;avversario diretto.
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.55)] px-4 py-6 text-sm text-amber-200">
              Nessun giocatore corrisponde ai filtri selezionati.
            </p>
          ) : (
            <div className="space-y-4">
              {filtered.map((entry, idx) => {
                const globalRank =
                  1 +
                  entries.findIndex(
                    (x) =>
                      x.teamId === entry.teamId &&
                      normalizePlayerName(x.playerName) === normalizePlayerName(entry.playerName)
                  );
                const rosterKey = `${entry.teamId}|${normalizePlayerName(entry.playerName)}`;
                const m = selectedMetricsByRosterKey.get(rosterKey);
                const pos = m?.positionCode ?? "n/d";
                const marking = simpleLevelFromScore(entry.matchupScore);
                const topAgg = entry.aggressors.slice(0, 3);
                const primaryAggMetric =
                  topAgg.length > 0 ? resolveAggressorMetric(topAgg[0]!, selectedMatch, selectedMetricsByRosterKey) : undefined;
                const { foulsOuBlock, cardsOuBlock } = buildOuBlocks(m);

                return (
                  <RiskCommittedRow
                    key={`foul-committed-panel-${entry.playerId ?? entry.playerName}-${idx}`}
                    rank={globalRank > 0 ? globalRank : idx + 1}
                    entry={entry}
                    positionCode={pos}
                    markingLabel={marking}
                    playerMetric={m}
                    primaryAggressorMetric={primaryAggMetric}
                    topAggressors={topAgg}
                    foulsOuBlock={foulsOuBlock}
                    cardsOuBlock={cardsOuBlock}
                  />
                );
              })}
            </div>
          )}

          <CommittedRiskFooterBar lastUpdatedDisplay={lastUpdatedDisplay} />
        </div>
      </div>
    </div>
  );
}
