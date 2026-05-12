import clsx from "clsx";
import { PlayerMiniCard } from "./player-mini-card";
import type { MatchupPlayerModel } from "./types";

interface PlayerVsCardProps {
  playerA: MatchupPlayerModel;
  playerB: MatchupPlayerModel;
  className?: string;
}

export function PlayerVsCard({ playerA, playerB, className }: PlayerVsCardProps) {
  return (
    <div className={clsx("relative", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-3">
        <PlayerMiniCard player={playerA} />
        <div className="flex items-center justify-center sm:w-16">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(120,170,255,0.35)] bg-gradient-to-br from-[#0c1220] to-[#040B14] text-lg font-black tracking-tight text-[#F8FAFC] shadow-[0_0_32px_rgba(14,165,233,0.25)]"
            aria-hidden
          >
            VS
          </div>
        </div>
        <PlayerMiniCard player={playerB} />
      </div>
    </div>
  );
}
