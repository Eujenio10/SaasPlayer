"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DifficultMarkingZoneField } from "@/components/difficult-markings/zone-field";
import { markingOverlapFieldProps } from "@/lib/difficult-markings/visualization";
import { reliabilityLabelIt } from "@/lib/difficult-markings/reasons";
import {
  difficultMarkingAttackerThreatLineIt,
  difficultMarkingSubjectHintIt,
  difficultMarkingSubjectLineIt
} from "@/lib/difficult-markings/text";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import type { DifficultMarkingFilterKey, DifficultMarkingSortKey } from "@/lib/difficult-markings/publish";
import { useWebCompetitionsWithMatches } from "@/components/competitions/use-web-competitions-with-matches";
import { resolveCompetitionId } from "@/lib/competitions";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT } from "@/lib/kiosk-persisted-insights";
import { translateTeamName } from "@/lib/italian-sports-display";
import {
  difficultMarkingLevelLabelIt,
  zoneLabelIt
} from "@/lib/difficult-markings/scoring";

function levelColor(score: number): string {
  if (score >= 85) return "text-rose-300";
  if (score >= 75) return "text-orange-300";
  if (score >= 65) return "text-amber-300";
  return "text-yellow-200";
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function DifficultMarkingsPage() {
  const { competitions: availableCompetitions, preferredId } = useWebCompetitionsWithMatches();
  const [competitionId, setCompetitionId] = useState(DEFAULT_MENU_COMPETITION_ID);
  const [round, setRound] = useState<string>("");
  const [filter, setFilter] = useState<DifficultMarkingFilterKey>("all");
  const [sort, setSort] = useState<DifficultMarkingSortKey>("score");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DifficultMarkingMatchup[]>([]);
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [officialLineupsUsed, setOfficialLineupsUsed] = useState(false);

  useEffect(() => {
    if (!preferredId) return;
    if (!availableCompetitions.some((c) => c.id === competitionId)) {
      setCompetitionId(preferredId);
    }
  }, [availableCompetitions, competitionId, preferredId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        competitionId,
        filter,
        sort
      });
      if (round) params.set("round", round);
      const res = await fetch(`/api/difficult-markings?${params.toString()}`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as {
        results?: DifficultMarkingMatchup[];
        availableRounds?: string[];
        updatedAt?: string | null;
        round?: string;
        officialLineupsUsed?: boolean;
        resolvedCompetitionId?: string;
      };
      setResults(Array.isArray(json.results) ? json.results : []);
      setAvailableRounds(Array.isArray(json.availableRounds) ? json.availableRounds : []);
      setUpdatedAt(json.updatedAt ?? null);
      setOfficialLineupsUsed(Boolean(json.officialLineupsUsed));
      const resolved = resolveCompetitionId(json.resolvedCompetitionId);
      if (resolved && resolved !== competitionId) {
        setCompetitionId(resolved);
        setRound("");
      } else if (!round && json.round) {
        setRound(String(json.round));
      }
    } catch {
      setError("Impossibile caricare le marcature difficili.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId, round, filter, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onRefresh);
  }, [load]);

  const hero = results[0] ?? null;
  const rest = useMemo(() => results.slice(1), [results]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-orange-400/10 via-white/[0.04] to-rose-400/10 p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">
          Pre-partita
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Marcature difficili</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Per ogni duello indichiamo il marcatore che dovrà arginare un attaccante difficile, con indice 0–100
          basato su falli subiti, dribbling e compatibilità tattica.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-400">
            Campionato
            <select
              value={competitionId}
              onChange={(e) => {
                const next = resolveCompetitionId(e.target.value);
                if (!next) return;
                setRound("");
                setCompetitionId(next);
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              {availableCompetitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            Giornata
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              {(availableRounds.length ? availableRounds : round ? [round] : []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            Filtro
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DifficultMarkingFilterKey)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="all">Tutte le partite</option>
              <option value="winger_fullback">Ali contro terzini</option>
              <option value="striker_cb">Centravanti contro centrali</option>
              <option value="am_dm">Trequartisti contro mediani</option>
              <option value="high_reliability">Affidabilità alta</option>
              <option value="official_lineup">Formazione ufficiale</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            Ordine
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DifficultMarkingSortKey)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="score">Indice marcatura</option>
              <option value="fouls_drawn">Falli subiti attaccante</option>
              <option value="dribbles">Dribbling attaccante</option>
              <option value="reliability">Affidabilità</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <span>Formazioni: {officialLineupsUsed ? "ufficiali" : "probabili"}</span>
          <span>Ultimo aggiornamento: {formatUpdatedAt(updatedAt)}</span>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-950/20 p-6 text-rose-100">{error}</div>
      ) : !results.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
          Nessuna marcatura sufficientemente rilevante è stata individuata per questa giornata.
        </div>
      ) : (
        <>
          {hero ? (
            <section className="overflow-hidden rounded-[1.75rem] border border-orange-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/30 p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-200/80">Marcatura più difficile</p>
                  <h2 className="text-2xl font-bold text-white">{difficultMarkingSubjectLineIt(hero)}</h2>
                  <p className="text-sm text-slate-400">{difficultMarkingSubjectHintIt()}</p>
                  <p className="text-sm font-medium text-orange-200/90">
                    {difficultMarkingAttackerThreatLineIt(hero)}
                  </p>
                  <p className="text-sm text-slate-300">
                    {translateTeamName(hero.homeTeamName)} vs {translateTeamName(hero.awayTeamName)} ·{" "}
                    {zoneLabelIt(hero.probableZone)}
                  </p>
                  <ul className="space-y-1 text-sm text-slate-200">
                    {hero.reasons.slice(0, 3).map((reason) => (
                      <li key={reason.type}>• {reason.label}: {reason.detail}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/kiosk/marcature-difficili/${encodeURIComponent(hero.id)}`}
                    className="inline-flex rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
                  >
                    Apri analisi
                  </Link>
                </div>
                <div className="flex flex-col items-center gap-5">
                  <div className="text-center">
                    <div className={`text-6xl font-black ${levelColor(hero.difficultMarkingScore)}`}>
                      {hero.difficultMarkingScore}
                      <span className="text-2xl text-slate-400">/100</span>
                    </div>
                    <p className={`mt-2 text-lg font-semibold ${levelColor(hero.difficultMarkingScore)}`}>
                      {difficultMarkingLevelLabelIt(hero.difficultMarkingLevel)}
                    </p>
                  </div>
                  <div className="w-full max-w-[280px]">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Sovrapposizione zone
                    </p>
                    <DifficultMarkingZoneField {...markingOverlapFieldProps(hero)} />
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            {rest.map((item, index) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm transition hover:border-orange-400/20"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">#{index + 2}</p>
                    <h3 className="font-semibold text-white">{difficultMarkingSubjectLineIt(item)}</h3>
                    <p className="text-xs text-orange-200/80">{difficultMarkingAttackerThreatLineIt(item)}</p>
                    <p className="text-xs text-slate-400">
                      {translateTeamName(item.homeTeamName)} vs {translateTeamName(item.awayTeamName)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${levelColor(item.difficultMarkingScore)}`}>
                      {item.difficultMarkingScore}
                    </p>
                    <p className="text-xs text-slate-400">{difficultMarkingLevelLabelIt(item.difficultMarkingLevel)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                  <span>Falli subiti: {(item.attackerMetrics.foulsDrawnPer90 ?? 0).toFixed(1)}</span>
                  <span>Dribbling riusciti: {(item.attackerMetrics.dribblesSuccessfulPer90 ?? 0).toFixed(1)}</span>
                  <span>Falli marcatore: {(item.defenderMetrics.foulsCommittedPer90 ?? 0).toFixed(1)}</span>
                  <span>Overlap: {item.heatmapOverlapPct}%</span>
                </div>
                <div className="mt-3 max-w-[220px]">
                  <DifficultMarkingZoneField compact {...markingOverlapFieldProps(item)} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Affidabilità {reliabilityLabelIt(item.reliabilityScore)}
                  </span>
                  <Link
                    href={`/kiosk/marcature-difficili/${encodeURIComponent(item.id)}`}
                    className="text-sm font-semibold text-orange-300 hover:text-orange-200"
                  >
                    Dettaglio
                  </Link>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
