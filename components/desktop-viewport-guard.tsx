"use client";

import { useEffect, useMemo, useState } from "react";

interface DesktopViewportGuardProps {
  children: React.ReactNode;
  /**
   * Per schermi vetrina / digital signage (spesso touch o risoluzioni particolari):
   * richiede solo dimensioni minime, senza escludere i dispositivi touch.
   */
  allowPublicDisplayFormat?: boolean;
}

function isDesktopViewport(): boolean {
  const widthOk = window.innerWidth >= 1100;
  const heightOk = window.innerHeight >= 700;
  const touchHeavy = navigator.maxTouchPoints > 1;
  return widthOk && heightOk && !touchHeavy;
}

function isPublicDisplayViewport(): boolean {
  return window.innerWidth >= 1024 && window.innerHeight >= 540;
}

export function DesktopViewportGuard({
  children,
  allowPublicDisplayFormat = false
}: DesktopViewportGuardProps) {
  const [allowed, setAllowed] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function evaluate() {
      setAllowed(
        allowPublicDisplayFormat ? isPublicDisplayViewport() : isDesktopViewport()
      );
      setChecked(true);
    }

    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, [allowPublicDisplayFormat]);

  const blocker = useMemo(
    () => (
      <section className="rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 text-slate-200">
        <h2 className="text-2xl font-bold text-cyan-300">Schermo non adatto</h2>
        <p className="mt-3">
          {allowPublicDisplayFormat ? (
            <>
              Per la vetrina serve almeno una risoluzione di <strong>1024×540</strong> pixel (orizzontale).
            </>
          ) : (
            <>
              Questa modalita e disponibile esclusivamente su postazioni desktop dedicate con monitor operativo
              (no touch), minimo circa 1100×700 px.
            </>
          )}
        </p>
      </section>
    ),
    [allowPublicDisplayFormat]
  );

  if (!checked) return null;
  if (!allowed) return blocker;
  return <>{children}</>;
}
