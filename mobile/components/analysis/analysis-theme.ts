export const analysisColors = {
  bg: "#020704",
  card: "#061009",
  cardAlt: "#08150D",
  green: "#7CFF3A",
  greenMid: "#45E51B",
  text: "#F4F7F5",
  textMuted: "#8B9690",
  border: "rgba(124,255,58,0.22)",
  borderStrong: "rgba(124,255,58,0.4)",
  glow: "rgba(124,255,58,0.18)",
  ctaText: "#041208"
} as const;

export function playerInitials(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "—";
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}
