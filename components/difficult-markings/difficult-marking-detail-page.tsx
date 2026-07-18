"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DifficultMarkingZoneField } from "@/components/difficult-markings/zone-field";
import {
  difficultMarkingLevelLabelIt,
  zoneLabelIt
} from "@/lib/difficult-markings/scoring";
import { reliabilityLabelIt } from "@/lib/difficult-markings/reasons";
import { roleLabelIt } from "@/lib/difficult-markings/roles";
import { markingOverlapFieldProps } from "@/lib/difficult-markings/visualization";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { translateTeamName } from "@/lib/italian-sports-display";

function levelColor(score: number): string {
  if (score >= 85) return "text-rose-300";
  if (score >= 75) return "text-orange-300";
  if (score >= 65) return "text-amber-300";
  return "text-yellow-200";
}

export function DifficultMarkingDetailPage({ matchupId }: { matchupId: string }) {
  const [matchup, setMatchup] = useState<DifficultMarkingMatchup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldMode, setFieldMode] = useState<"overlap" | "attacker" | "defender">("overlap");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/difficult-markings/${encodeURIComponent(matchupId)}`, {
          cache: "no-store",
          credentials: "include"
        });
        if (res.status === 404) {
          if (!cancelled) {
            setMatchup(null);
            setError("Questo confronto non è più disponibile per la giornata selezionata.");
          }
          return;
        }
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as { matchup?: DifficultMarkingMatchup };
        if (!cancelled) setMatchup(json.matchup ?? null);
      } catch {
        if (!cancelled) setError("Impossibile caricare il dettaglio del confronto.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [matchupId]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-20 text-center text-slate-300">Caricamento analisi…</div>;
  }

  if (error || !matchup) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
          {error ?? "Confronto non trovato."}
        </div>
        <div className="mt-6 text-center">
          <Link href="/kiosk/marcature-difficili" className="text-orange-300 hover:text-orange-200">
            Torna all&apos;elenco
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <Link href="/kiosk/marcature-difficili" className="text-sm text-orange-300 hover:text-orange-200">
        ← Marcature difficili
      </Link>

      <section className="grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="text-left">
          <p className="text-2xl font-bold text-white">{matchup.defenderPlayerName}</p>
          <p className="text-sm text-slate-400">{roleLabelIt(matchup.defenderRole)}</p>
          <p className="mt-1 text-xs text-slate-500">{translateTeamName(matchup.defenderTeamName)}</p>
        </div>
        <div className="text-center">
          <p className={`text-5xl font-black ${levelColor(matchup.difficultMarkingScore)}`}>
            {matchup.difficultMarkingScore}
            <span className="text-xl text-slate-400">/100</span>
          </p>
          <p className={`font-semibold ${levelColor(matchup.difficultMarkingScore)}`}>
            {difficultMarkingLevelLabelIt(matchup.difficultMarkingLevel)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Affidabilità {reliabilityLabelIt(matchup.reliabilityScore)} ·{" "}
            {matchup.officialLineupsUsed ? "Formazioni ufficiali" : "Formazioni probabili"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{matchup.attackerPlayerName}</p>
          <p className="text-sm text-slate-400">{roleLabelIt(matchup.attackerRole)}</p>
          <p className="mt-1 text-xs text-slate-500">{translateTeamName(matchup.attackerTeamName)}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
          <div className="flex flex-wrap gap-2">
            {(["overlap", "attacker", "defender"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFieldMode(mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  fieldMode === mode
                    ? "bg-orange-500 text-slate-950"
                    : "border border-white/10 text-slate-300"
                }`}
              >
                {mode === "overlap" ? "Sovrapposizione" : mode === "attacker" ? "Attaccante" : "Marcatore"}
              </button>
            ))}
          </div>
          <DifficultMarkingZoneField
            {...markingOverlapFieldProps(matchup)}
            mode={fieldMode === "overlap" ? "clash" : fieldMode}
          />
          <p className="text-sm text-slate-300">
            {translateTeamName(matchup.homeTeamName)} vs {translateTeamName(matchup.awayTeamName)} ·{" "}
            {zoneLabelIt(matchup.probableZone)}
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Perché è una marcatura difficile</h2>
          <div className="grid gap-3">
            {matchup.reasons.map((reason) => (
              <div key={reason.type} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-medium text-white">{reason.label}</p>
                <p className="mt-1 text-sm text-slate-300">{reason.detail}</p>
                {reason.percentile != null ? (
                  <p className="mt-1 text-xs text-slate-500">Percentile ruolo: {reason.percentile}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatColumn
          title="Giocatore offensivo"
          rows={[
            ["Falli subiti /90", matchup.attackerMetrics.foulsDrawnPer90],
            ["Dribbling tentati /90", matchup.attackerMetrics.dribblesAttemptedPer90],
            ["Dribbling riusciti /90", matchup.attackerMetrics.dribblesSuccessfulPer90],
            ["Partite analizzate", matchup.sample.attackerMatches],
            ["Minuti analizzati", matchup.sample.attackerMinutes]
          ]}
        />
        <StatColumn
          title="Possibile marcatore"
          rows={[
            ["Falli commessi /90", matchup.defenderMetrics.foulsCommittedPer90],
            ["Partite con ammonizione", matchup.defenderMetrics.yellowCardMatchRate != null ? `${Math.round((matchup.defenderMetrics.yellowCardMatchRate ?? 0) * 100)}%` : null],
            ["Partite analizzate", matchup.sample.defenderMatches],
            ["Minuti analizzati", matchup.sample.defenderMinutes],
            ["Sovrapposizione zone", `${matchup.heatmapOverlapPct}%`]
          ]}
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
        <h2 className="mb-2 text-base font-semibold text-white">Campione e affidabilità</h2>
        <p>
          Attaccante: {matchup.sample.attackerMatches} partite, {matchup.sample.attackerMinutes} minuti · Marcatore:{" "}
          {matchup.sample.defenderMatches} partite, {matchup.sample.defenderMinutes} minuti · Heatmap disponibile:{" "}
          {matchup.usedHeatmap ? "sì" : "no"} · Affidabilità: {reliabilityLabelIt(matchup.reliabilityScore)}
        </p>
      </section>

      <blockquote className="rounded-2xl border border-cyan-400/10 bg-cyan-950/10 p-5 text-sm italic text-slate-300">
        L&apos;indice misura la difficoltà potenziale del confronto individuale considerando zone di gioco, dribbling,
        falli subiti e caratteristiche disciplinari del possibile marcatore. Non rappresenta una certezza di
        ammonizione.
      </blockquote>
    </div>
  );
}

function StatColumn({
  title,
  rows
}: {
  title: string;
  rows: Array<[string, number | string | null | undefined]>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="mb-4 font-semibold text-white">{title}</h3>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-400">{label}</dt>
            <dd className="font-medium text-white">
              {value == null || value === "" ? "—" : typeof value === "number" ? value.toFixed(1) : value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
