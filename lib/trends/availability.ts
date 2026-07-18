import type { TacticalMetrics } from "@/lib/types";
import type { PlayerAvailabilityForTrend, PlayerMatchTrendStats } from "@/lib/trends/types";
import { TREND_SAMPLE_REQUIREMENTS } from "@/lib/trends/thresholds";
import { isGoalkeeperAppearance } from "@/lib/trends/sample";

export function resolvePlayerAvailabilityForTrend(params: {
  playerId: string;
  recent: PlayerMatchTrendStats[];
  metric?: TacticalMetrics | null;
}): PlayerAvailabilityForTrend {
  const req = params.recent.some(isGoalkeeperAppearance)
    ? TREND_SAMPLE_REQUIREMENTS.goalkeeper
    : TREND_SAMPLE_REQUIREMENTS.outfield;

  const starterCount = params.recent.filter((a) => a.starter).length;
  const playedCount = params.recent.length;

  const startProbability = playedCount > 0 ? starterCount / playedCount : 0;

  if (startProbability >= 0.72 && starterCount >= req.starterMatchesMin) {
    return {
      playerId: params.playerId,
      likelyAvailable: true,
      startProbability,
      availabilityLabel: "probable_starter"
    };
  }

  if (playedCount >= req.playedRecentMin && starterCount >= req.starterMatchesMin - 1) {
    return {
      playerId: params.playerId,
      likelyAvailable: true,
      startProbability,
      availabilityLabel: "regular_player"
    };
  }

  if (startProbability >= 0.45) {
    return {
      playerId: params.playerId,
      likelyAvailable: true,
      startProbability,
      availabilityLabel: "uncertain"
    };
  }

  return {
    playerId: params.playerId,
    likelyAvailable: false,
    startProbability,
    availabilityLabel: "uncertain"
  };
}
