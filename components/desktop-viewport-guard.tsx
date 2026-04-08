"use client";

import { useEffect, useState } from "react";

interface DesktopViewportGuardProps {
  children: React.ReactNode;
  /**
   * @deprecated Non più usato: l’interfaccia è accessibile da qualsiasi viewport (telefono incluso).
   * Mantenuto per compatibilità con le pagine esistenti.
   */
  allowPublicDisplayFormat?: boolean;
}

/**
 * Evita un flash di contenuto non idrato lato client. Non blocca più tablet/telefono:
 * kiosk e display restano scrollabili e le tabelle larghe usano overflow orizzontale dove serve.
 */
export function DesktopViewportGuard({ children }: DesktopViewportGuardProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
