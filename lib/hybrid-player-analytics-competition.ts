/**
 * Competizioni per cui il kiosk ibrido (`playerAnalytics=serie_a_players`) carica
 * statistiche giocatori e heatmap (come per la Serie A). Allineato al filtro menu UEFA in sportapi.
 */
function normalizeSlug(raw?: string): string {
  const s = raw?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  return s;
}

const UEFA_CHAMPIONS_OR_EUROPA_SLUGS = new Set([
  "uefa-champions-league",
  "uefa-europa-league",
  "champions-league",
  "europa-league"
]);

export function isHybridFullPlayerAnalyticsCompetitionSlug(slug?: string): boolean {
  const s = normalizeSlug(slug);
  if (s === "serie-a") return true;
  if (!s) return false;
  if (s.includes("conference")) return false;
  if (UEFA_CHAMPIONS_OR_EUROPA_SLUGS.has(s)) return true;
  return (
    (s.includes("champions") && s.includes("uefa")) ||
    (s.includes("europa") && s.includes("uefa") && s.includes("league"))
  );
}
