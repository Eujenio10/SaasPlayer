"use client";

import { useEffect, useState } from "react";
import { formatCountdownItalian, msUntilIso } from "@/lib/data-refresh/schedule";

export function useCountdownTo(targetIso: string | null | undefined): {
  msRemaining: number | null;
  countdownLabel: string | null;
} {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) {
    return { msRemaining: null, countdownLabel: null };
  }

  const msRemaining = msUntilIso(targetIso, nowMs);
  return {
    msRemaining,
    countdownLabel: formatCountdownItalian(msRemaining)
  };
}
