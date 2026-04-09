"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import { frictionExplanationForDisplay } from "@/lib/friction-display-copy";
import type { DisplayProgramPayload, DisplayProgramSlide } from "@/lib/types";

const SLIDE_MS = 10_000;
const REFRESH_MS = 18 * 60 * 1000;

interface DisplayCarouselProps {
  initialProgram: DisplayProgramPayload;
  organizationId: string;
  /** Layout più compatto in modalità vetrina / fullscreen. */
  immersive?: boolean;
}

function slideStableKey(slide: DisplayProgramSlide, index: number): string {
  if (slide.kind === "friction") {
    return `friction-${slide.eventId}-${slide.narrative.slice(0, 48)}-${index}`;
  }
  return `shooters-${slide.eventId}-${index}`;
}

export function DisplayCarousel({
  initialProgram,
  organizationId,
  immersive = false
}: DisplayCarouselProps) {
  const [program, setProgram] = useState<DisplayProgramPayload>(initialProgram);
  const [index, setIndex] = useState(0);

  const slides = program.slides;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length, program.updatedAt]);

  useEffect(() => {
    if (!slides.length) {
      setIndex(0);
      return;
    }
    if (index >= slides.length) {
      setIndex(0);
    }
  }, [index, slides.length]);

  useEffect(() => {
    async function pull(refresh: boolean) {
      const response = await fetch(
        `/api/tactical/display-program${refresh ? "?refresh=1" : ""}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const json = (await response.json()) as DisplayProgramPayload;
      if (Array.isArray(json.slides)) {
        setProgram(json);
      }
    }

    // Se la pagina è stata renderizzata durante un momento di cache “vuota” (es. quota/piano aggiornati),
    // forza un refresh una sola volta al mount per riprendersi subito senza attendere il polling.
    if (!slides.length) {
      void pull(true);
    }

    const interval = window.setInterval(() => {
      void pull(false);
    }, REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [organizationId, slides.length]);

  const current = slides[index];
  const motionKey = useMemo(
    () => (current ? slideStableKey(current, index) : "empty"),
    [current, index]
  );

  const contextLabel =
    program.programContext === "serie_a_next"
      ? "Prossimo match — Serie A / Champions / Europa"
      : "Serie A — partite di oggi";

  if (!slides.length) {
    const emptyCopy =
      program.sourceStatus === "error"
        ? "Errore temporaneo nel recupero dei dati SportAPI."
        : program.programContext === "serie_a_today"
          ? "Ci sono (o c’erano) partite oggi, ma heatmap e tiratori non sono disponibili al momento. Riprova tra qualche minuto."
          : program.programContext === "serie_a_next"
            ? "Non risultano partite future tra Serie A, Champions League ed Europa League nel calendario, oppure i dati tattici non sono ancora pronti."
            : "Oggi non risultano partite di Serie A ancora da disputare nel calendario, oppure i dati giocatori non sono disponibili.";

    return (
      <div className="rounded-2xl border border-amber-400/25 bg-slate-950/80 p-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-500/80">{contextLabel}</p>
        <p className="mt-3 text-2xl font-semibold text-amber-100 md:text-3xl">
          Programma Serie A non disponibile
        </p>
        <p className="mt-4 text-lg text-slate-400 md:text-xl">{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className={immersive ? "space-y-4" : "space-y-6"}>
      <div
        className={`flex flex-wrap items-end justify-between gap-4 text-slate-500 ${immersive ? "text-xs md:text-sm" : ""}`}
      >
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-500/90">{contextLabel}</p>
        <p className="text-xs text-slate-500">
          Aggiornato:{" "}
          {new Date(program.updatedAt).toLocaleString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={motionKey}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -28 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
          className={
            immersive
              ? "rounded-2xl border border-cyan-400/20 bg-graphite/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-6"
              : "rounded-2xl border border-cyan-400/20 bg-graphite/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-10"
          }
        >
          {current.kind === "friction" ? (
            <FrictionSlide slide={current} />
          ) : (
            <ShootersSlide slide={current} />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={slideStableKey(s, i)}
            type="button"
            aria-label={`Vai alla slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? "w-10 bg-cyan-400" : "w-2.5 bg-slate-600 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FrictionSlide({ slide }: { slide: Extract<DisplayProgramSlide, { kind: "friction" }> }) {
  const explanation = frictionExplanationForDisplay(slide.frictionExplanation);

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-b border-white/10 pb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-cyan-300/90 md:text-base">
          {slide.competitionLabel} · {slide.kickoffLabel}
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 md:text-5xl lg:text-6xl">
          {slide.matchTitle}
        </h2>
        <p className="text-xl text-cyan-100/95 md:text-2xl lg:text-3xl">{slide.narrative}</p>
      </header>

      <div className="rounded-xl border border-emerald-500/20 bg-slate-950/50 p-4 md:p-6">
        <p className="mb-4 text-sm font-medium text-slate-400 md:text-base">
          Heatmap stagionale — confronto tra le zone di presenza in campionato
        </p>
        <FrictionPitchHeatmap {...slide.heatmap} />
      </div>

      {explanation ? (
        <p className="text-lg leading-relaxed text-slate-300 md:text-xl lg:text-2xl">{explanation}</p>
      ) : null}
    </div>
  );
}

function ShootersSlide({ slide }: { slide: Extract<DisplayProgramSlide, { kind: "shooters" }> }) {
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-white/10 pb-6">
        <p className="text-sm font-medium uppercase tracking-wider text-amber-200/90 md:text-base">
          Top tiratori — ultime 2 partite di campionato
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 md:text-5xl lg:text-6xl">
          {slide.matchTitle}
        </h2>
        <p className="text-lg text-slate-400 md:text-xl">
          {slide.competitionLabel} · {slide.kickoffLabel}
        </p>
        {slide.chunkHint ? (
          <p className="text-base font-medium text-amber-300/90 md:text-lg">{slide.chunkHint}</p>
        ) : null}
      </header>

      <ul className="space-y-4">
        {slide.players.map((p) => (
          <li
            key={`${p.playerName}-${p.team}-${p.rank}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/50 px-5 py-4 md:px-8 md:py-5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-cyan-300 md:h-14 md:w-14 md:text-2xl">
                {p.rank}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-slate-50 md:text-2xl lg:text-3xl">
                  <span className="mr-2">{p.roleIcon}</span>
                  {p.playerName}
                </p>
                <p className="mt-1 flex items-center gap-2 text-base text-slate-400 md:text-lg">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-white/15"
                    style={{ backgroundColor: p.clubColor }}
                  />
                  <span className="truncate">
                    {p.team}
                    {p.jerseyNumber > 0 ? ` · #${p.jerseyNumber}` : ""}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums text-amber-200 md:text-4xl">
                {p.shotsLastTwoAvg.toFixed(1)}
              </p>
              <p className="text-sm text-slate-500 md:text-base">tiri / partita (media)</p>
              <p className="text-xs text-slate-600">campione: ultime {p.shotsLastTwoSampleCount} gare</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
