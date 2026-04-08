"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DesktopViewportGuard } from "@/components/desktop-viewport-guard";
import { DisplayCarousel } from "@/components/display-carousel";
import type { DisplayProgramPayload } from "@/lib/types";

interface DisplayViewProps {
  initialProgram: DisplayProgramPayload;
  organizationId: string;
  /** Link vetrina: `/display?vetrina=1` — messaggio dedicato e formato schermo più permissivo. */
  vetrinaQuery: boolean;
}

export function DisplayView({
  initialProgram,
  organizationId,
  vetrinaQuery
}: DisplayViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [immersive, setImmersive] = useState(false);

  const exitVetrina = useCallback(() => {
    if (typeof document !== "undefined") {
      const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen();
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
        doc.webkitExitFullscreen();
      }
    }
    document.body.classList.remove("display-street-mode");
    setImmersive(false);
  }, []);

  const enterVetrina = useCallback(async () => {
    document.body.classList.add("display-street-mode");
    setImmersive(true);
    const el = rootRef.current;
    if (el && typeof document !== "undefined") {
      const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
      try {
        if (document.fullscreenEnabled && el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (typeof anyEl.webkitRequestFullscreen === "function") {
          await Promise.resolve(anyEl.webkitRequestFullscreen());
        }
      } catch {
        /* resta layout vetrina senza fullscreen di sistema */
      }
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      if (typeof document === "undefined") return;
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      if (!fsEl) {
        document.body.classList.remove("display-street-mode");
        setImmersive(false);
      }
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("display-street-mode");
      }
    };
  }, []);

  return (
    <DesktopViewportGuard allowPublicDisplayFormat>
      <div
        ref={rootRef}
        className={
          immersive
            ? "flex min-h-[100dvh] flex-col bg-[#070b12]"
            : "min-h-[calc(100vh-8rem)] space-y-8 py-2"
        }
      >
        {!immersive ? (
          <header className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold tracking-tight text-cyan-300 md:text-7xl">
                Tactical TV — Serie A
              </h1>
              <p className="text-2xl text-slate-300 md:text-3xl">
                Heatmap scontri e top tiratori: in giornata le partite di Serie A di oggi; se non ce ne sono, il
                prossimo match più vicino tra Serie A, Champions League ed Europa League. Stessa cache del kiosk.
              </p>
            </div>
            {vetrinaQuery ? (
              <p className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-3 text-lg text-cyan-100 md:text-xl">
                Link <strong>vetrina</strong>: dopo l&apos;accesso, usa il pulsante qui sotto per lo schermo intero
                (richiesto dal browser per i passanti).
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void enterVetrina()}
                className="rounded-xl border-2 border-cyan-400 bg-cyan-500/20 px-6 py-4 text-lg font-semibold tracking-wide text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-400/30 md:text-xl"
              >
                Modalità vetrina — schermo intero
              </button>
              <p className="max-w-xl text-sm text-slate-500 md:text-base">
                Nasconde barre del sito e passa al fullscreen del browser: ideale per monitor in vetrina o
                ingresso.
              </p>
            </div>
          </header>
        ) : (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-2 backdrop-blur-sm">
            <p className="text-sm font-medium uppercase tracking-widest text-cyan-400/90 md:text-base">
              Tactical TV · Serie A
            </p>
            <button
              type="button"
              onClick={() => exitVetrina()}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/20 md:text-base"
            >
              Esci schermo intero
            </button>
          </div>
        )}

        <div className={immersive ? "min-h-0 flex-1 overflow-auto px-3 py-4 md:px-6 md:py-6" : ""}>
          <DisplayCarousel
            initialProgram={initialProgram}
            organizationId={organizationId}
            immersive={immersive}
          />
        </div>
      </div>
    </DesktopViewportGuard>
  );
}
