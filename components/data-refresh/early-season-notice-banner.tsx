"use client";

import { Info } from "lucide-react";
import { EARLY_SEASON_BANNER_MESSAGE, isEarlySeasonWindow } from "@/lib/season-fallback/early-season-window";

export function EarlySeasonNoticeBanner() {
  if (!isEarlySeasonWindow()) return null;

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-400/8 px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-200">
          <Info className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold leading-6 text-amber-100">{EARLY_SEASON_BANNER_MESSAGE}</p>
      </div>
    </div>
  );
}
