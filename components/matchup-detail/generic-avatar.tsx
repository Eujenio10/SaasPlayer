import clsx from "clsx";
import { User } from "lucide-react";
import type { MatchupAccent } from "./types";
import { MATCHUP_COLORS } from "./matchup-mapping";

interface GenericAvatarProps {
  accent: MatchupAccent;
  className?: string;
}

export function GenericAvatar({ accent, className }: GenericAvatarProps) {
  const stroke = accent === "blue" ? MATCHUP_COLORS.blue : MATCHUP_COLORS.red;
  return (
    <div
      className={clsx(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-[#040B14]",
        "shadow-[0_0_24px_rgba(14,165,233,0.15)]",
        className
      )}
      style={{
        borderColor: stroke,
        boxShadow: `0 0 20px ${stroke}33, inset 0 0 18px ${stroke}22`
      }}
    >
      <User className="h-7 w-7" style={{ color: stroke }} strokeWidth={2} aria-hidden />
    </div>
  );
}
