/**
 * Riconoscimento **Coppa del Mondo FIFA maschile senior** (nazionali).
 * Esclusi: Mondiali femminili, Europei, tornei Under / youth, Club World Cup, olimpiadi calcio.
 * Override opzionale: `TACTICAL_INTL_TOURNAMENT_SLUG_INCLUDES` (frammenti slug, separati da virgola).
 */

export function normalizeInternationalTournamentSlug(raw?: string): string {
  const s = raw?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  return s;
}

/** Es. FIFA U-20 World Cup, Europei Under 21, tornei youth. */
function looksLikeYouthAgeTierOrOlympicSlug(s: string): boolean {
  const t = s.toLowerCase();
  if (/(^|[^a-z0-9])u-?(1[7-9]|2[0-3])([^0-9]|$)/.test(t)) return true;
  if (/\bunder[- ]?(1[7-9]|2[0-3])\b/.test(t)) return true;
  if (t.includes("youth") || t.includes("junior")) return true;
  if (t.includes("olymp")) return true;
  return false;
}

/** FIFA Club World Cup / interclub — non è il torneo nazionale che trattiamo nel menu. */
function looksLikeClubWorldCupSlug(s: string): boolean {
  const t = s.toLowerCase();
  return t.includes("club") && (t.includes("world") || t.includes("cup"));
}

/** Mondiali / tornei FIFA femminili: non trattati nel menù internazionale. */
function looksLikeWomensFootballTournamentSlug(s: string): boolean {
  const t = s.toLowerCase();
  return (
    t.includes("women") ||
    t.includes("womans") ||
    t.includes("woman-") ||
    t.includes("-woman") ||
    t.includes("female") ||
    t.includes("feminin") ||
    t.includes("donne") ||
    t.includes("ladies")
  );
}

function looksLikeFifaWorldCupSlug(s: string): boolean {
  /** Su molti provider (stile SofaScore) anche `world-championship` = Coppa del Mondo maschile senior. */
  return (
    s.includes("world-cup") ||
    s.includes("worldcup") ||
    s.includes("fifa-world") ||
    (s.includes("world") && s.includes("championship")) ||
    (s.includes("fifa") && s.includes("world"))
  );
}

/**
 * Slug competitizione: Coppa del Mondo FIFA **maschile** (maggiore, nazionali nel calendario).
 * Non include Europei UEFA né edizioni Under / femminili.
 */
export function isInternationalTournamentSlug(raw?: string): boolean {
  const s = normalizeInternationalTournamentSlug(raw);
  if (!s) return false;

  if (looksLikeWomensFootballTournamentSlug(s)) return false;

  /** Non confondere con UEFA Europa League / Conference League. */
  if (s.includes("europa-league") || s.includes("conference-league")) return false;
  if (
    (s.includes("europa") && s.includes("league")) ||
    (s.includes("conference") && s.includes("league"))
  ) {
    return false;
  }

  if (looksLikeClubWorldCupSlug(s)) return false;
  if (looksLikeYouthAgeTierOrOlympicSlug(s)) return false;

  if (looksLikeFifaWorldCupSlug(s)) return true;

  const extra =
    typeof process !== "undefined" &&
    typeof process.env?.TACTICAL_INTL_TOURNAMENT_SLUG_INCLUDES === "string"
      ? process.env.TACTICAL_INTL_TOURNAMENT_SLUG_INCLUDES.split(",").map((x) =>
          x.trim().toLowerCase()
        )
      : ([] as string[]);
  for (const frag of extra) {
    if (frag.length < 4) continue;
    if (!s.includes(frag)) continue;
    if (looksLikeWomensFootballTournamentSlug(s)) return false;
    if (looksLikeClubWorldCupSlug(s)) return false;
    if (looksLikeYouthAgeTierOrOlympicSlug(s)) return false;
    return true;
  }
  return false;
}
