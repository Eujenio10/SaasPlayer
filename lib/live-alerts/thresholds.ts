import type { LiveStatisticName } from "@/lib/live-alerts/types";

export const LIVE_STAT_RANGE: Record<LiveStatisticName, { min: number; max: number; step: number }> = {
  goal_scored: { min: 1, max: 8, step: 1 },
  goal_conceded: { min: 1, max: 8, step: 1 },
  red_card: { min: 1, max: 3, step: 1 },
  penalty: { min: 1, max: 3, step: 1 },
  shots: { min: 0, max: 30, step: 1 },
  shots_on_target: { min: 0, max: 15, step: 1 },
  corners: { min: 0, max: 15, step: 1 },
  fouls: { min: 0, max: 25, step: 1 },
  yellow_cards: { min: 0, max: 10, step: 1 },
  goal: { min: 1, max: 4, step: 1 },
  assist: { min: 1, max: 3, step: 1 },
  card: { min: 1, max: 2, step: 1 },
  fouls_received: { min: 0, max: 10, step: 1 },
  saves: { min: 0, max: 15, step: 1 }
};

export const PLAYER_SHOTS_RANGE = { min: 0, max: 10, step: 1 };
export const PLAYER_SHOTS_ON_TARGET_RANGE = { min: 0, max: 5, step: 1 };
export const PLAYER_FOULS_RANGE = { min: 0, max: 10, step: 1 };

export function rangeForStatistic(name: LiveStatisticName, alertType: "team" | "player") {
  if (alertType === "player" && name === "shots") return PLAYER_SHOTS_RANGE;
  if (alertType === "player" && name === "shots_on_target") return PLAYER_SHOTS_ON_TARGET_RANGE;
  if (alertType === "player" && name === "fouls") return PLAYER_FOULS_RANGE;
  return LIVE_STAT_RANGE[name] ?? { min: 1, max: 10, step: 1 };
}

export function clampTarget(name: LiveStatisticName, alertType: "team" | "player", value: number): number {
  const range = rangeForStatistic(name, alertType);
  const raw = Number.isFinite(value) ? Math.round(value) : range.min;
  return Math.min(range.max, Math.max(range.min, raw));
}

export const TEAM_EVENT_STATS = new Set<LiveStatisticName>([
  "goal_scored",
  "goal_conceded",
  "red_card",
  "penalty"
]);

export const PLAYER_EVENT_STATS = new Set<LiveStatisticName>(["goal", "assist", "card"]);

export function needsIncidents(statisticName: LiveStatisticName): boolean {
  return statisticName === "red_card" || statisticName === "penalty" || statisticName === "card";
}

export function needsTeamStats(statisticName: LiveStatisticName): boolean {
  return (
    statisticName === "shots" ||
    statisticName === "shots_on_target" ||
    statisticName === "corners" ||
    statisticName === "fouls" ||
    statisticName === "yellow_cards"
  );
}

export function needsPlayerStats(statisticName: LiveStatisticName): boolean {
  return (
    statisticName === "goal" ||
    statisticName === "assist" ||
    statisticName === "shots" ||
    statisticName === "shots_on_target" ||
    statisticName === "fouls" ||
    statisticName === "fouls_received" ||
    statisticName === "saves" ||
    statisticName === "card"
  );
}
