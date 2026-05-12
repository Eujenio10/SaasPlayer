import clsx from "clsx";
import { GenericAvatar } from "./generic-avatar";
import type { MatchupPlayerModel } from "./types";
import { MATCHUP_COLORS } from "./matchup-mapping";

interface PlayerMiniCardProps {
  player: MatchupPlayerModel;
}

export function PlayerMiniCard({ player }: PlayerMiniCardProps) {
  const accentCls =
    player.accent === "blue"
      ? "border-[rgba(14,165,233,0.35)] shadow-[0_0_26px_rgba(14,165,233,0.12)]"
      : "border-[rgba(239,68,68,0.35)] shadow-[0_0_26px_rgba(239,68,68,0.12)]";
  const badgeBg =
    player.accent === "blue"
      ? "bg-[rgba(14,165,233,0.15)] text-[#7dd3fc]"
      : "bg-[rgba(239,68,68,0.15)] text-[#fecaca]";

  const ring = MATCHUP_COLORS[player.accent];

  return (
    <article
      className={clsx(
        "flex flex-1 flex-col gap-3 rounded-2xl border bg-[rgba(8,16,32,0.65)] p-4 backdrop-blur-sm transition hover:border-[rgba(120,170,255,0.28)]",
        accentCls
      )}
    >
      <div className="flex items-start gap-3">
        <GenericAvatar accent={player.accent} />
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-bold leading-tight tracking-wide text-[#F8FAFC]"
            style={{ textShadow: `0 0 12px ${ring}33` }}
          >
            {player.firstName}
            <br />
            {player.lastName}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">{player.team}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", badgeBg)}>
          {player.roleLabel}
        </span>
      </div>
      <p className="text-[11px] text-[#94A3B8]">
        Posizione media <span className="font-semibold text-[#F8FAFC]">{player.position}</span>
      </p>
    </article>
  );
}
