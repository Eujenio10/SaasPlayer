"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TacticalCard } from "@/components/tactical-card";
import type { TacticalMetrics } from "@/lib/types";

interface PlayerComparisonProps {
  initialMetrics: TacticalMetrics[];
  organizationId: string;
  fixtureId: string;
}

export function PlayerComparison({
  initialMetrics,
  organizationId,
  fixtureId
}: PlayerComparisonProps) {
  const [metrics, setMetrics] = useState<TacticalMetrics[]>(initialMetrics);
  const [leftPlayer, setLeftPlayer] = useState(initialMetrics[0]?.playerName ?? "");
  const [rightPlayer, setRightPlayer] = useState(initialMetrics[1]?.playerName ?? "");

  const left = useMemo(
    () => metrics.find((item) => item.playerName === leftPlayer),
    [metrics, leftPlayer]
  );
  const right = useMemo(
    () => metrics.find((item) => item.playerName === rightPlayer),
    [metrics, rightPlayer]
  );

  useEffect(() => {
    if (!metrics.length) return;
    if (!metrics.some((item) => item.playerName === leftPlayer)) {
      setLeftPlayer(metrics[0].playerName);
    }
    if (!metrics.some((item) => item.playerName === rightPlayer)) {
      setRightPlayer(metrics[Math.min(1, metrics.length - 1)].playerName);
    }
  }, [metrics, leftPlayer, rightPlayer]);

  useEffect(() => {
    async function reloadSnapshot() {
      const response = await fetch(
        `/api/tactical/snapshot?fixtureId=${encodeURIComponent(fixtureId)}`,
        {
          cache: "no-store"
        }
      );
      if (!response.ok) return;
      const json = (await response.json()) as { metrics?: TacticalMetrics[] };
      if (Array.isArray(json.metrics)) {
        setMetrics(json.metrics);
      }
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`tactical-kiosk-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tactical_snapshots",
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          void reloadSnapshot();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, fixtureId]);

  return (
    <section className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Giocatore A</span>
          <select
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray p-3 text-slate-100"
            value={leftPlayer}
            onChange={(event) => setLeftPlayer(event.target.value)}
          >
            {metrics.map((item) => (
              <option key={`left-${item.playerName}`} value={item.playerName}>
                {item.playerName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Giocatore B</span>
          <select
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray p-3 text-slate-100"
            value={rightPlayer}
            onChange={(event) => setRightPlayer(event.target.value)}
          >
            {metrics.map((item) => (
              <option key={`right-${item.playerName}`} value={item.playerName}>
                {item.playerName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {left ? <TacticalCard metrics={left} /> : null}
        {right ? <TacticalCard metrics={right} /> : null}
      </div>
    </section>
  );
}
