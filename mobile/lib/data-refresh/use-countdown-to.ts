import { useEffect, useState } from "react";
import { formatCountdownItalian, computeNextDailyRefreshAt, msUntilIso } from "../../../lib/data-refresh/schedule";

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

  const remaining = msUntilIso(targetIso, nowMs);
  const msRemaining =
    remaining > 0 ? remaining : msUntilIso(computeNextDailyRefreshAt(new Date(nowMs)), nowMs);
  return {
    msRemaining,
    countdownLabel: formatCountdownItalian(msRemaining)
  };
}
