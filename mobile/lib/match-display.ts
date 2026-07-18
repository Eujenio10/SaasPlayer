const TEAM_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#06B6D4",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#F97316",
  "#A855F7",
  "#EF4444",
  "#22D3EE"
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function genericTeamColor(teamName: string): string {
  return TEAM_COLORS[hashSeed(teamName.toLowerCase()) % TEAM_COLORS.length]!;
}

export function teamInitialsFromName(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  if (!clean) return "—";
  const words = clean.split(/\s+/).filter((w) => !["FC", "AC", "AS", "CF", "SC", "US"].includes(w.toUpperCase()));
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? clean).slice(0, 3).toUpperCase();
}

export function formatMatchDateParts(timestampSec: number): {
  weekday: string;
  dayMonth: string;
  time: string;
  full: string;
} {
  const date = new Date(timestampSec * 1000);
  const weekday = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long"
  }).format(date);
  const dayMonth = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short"
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const time = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  const full = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return { weekday, dayMonth, time, full };
}

export function isMatchTodayRome(timestampSec: number): boolean {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date(timestampSec * 1000)) === fmt.format(new Date());
}

export type IntensityUiLevel = "low" | "medium" | "high";

export function intensityUiLevel(
  level: "low" | "medium" | "high" | "very_high" | undefined
): IntensityUiLevel {
  if (level === "very_high" || level === "high") return "high";
  if (level === "medium") return "medium";
  return "low";
}

export function intensityVisualStyle(level: IntensityUiLevel): {
  dot: string;
  text: string;
  border: string;
  background: string;
} {
  switch (level) {
    case "high":
      return {
        dot: "#FB7185",
        text: "#FB7185",
        border: "rgba(251,113,133,0.35)",
        background: "rgba(251,113,133,0.1)"
      };
    case "medium":
      return {
        dot: "#FCD34D",
        text: "#FCD34D",
        border: "rgba(252,211,77,0.35)",
        background: "rgba(252,211,77,0.1)"
      };
    default:
      return {
        dot: "#64748B",
        text: "#94A3B8",
        border: "rgba(100,116,139,0.28)",
        background: "rgba(100,116,139,0.08)"
      };
  }
}

export function intensityLevelLabel(level: IntensityUiLevel): string {
  if (level === "high") return "alta";
  if (level === "medium") return "media";
  return "bassa";
}
