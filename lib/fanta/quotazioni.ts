import { normalizePlayerNameKey } from "@/lib/player-identity";
import type { FantaRoleGroup } from "@/lib/fanta/types";
import quotations from "@/lib/fanta/quotazioni-2026-27.json";

export type FantacalcioListRole = "P" | "D" | "C" | "A";

export interface FantacalcioQuotation {
  id: string;
  role: FantacalcioListRole;
  mantra: string;
  name: string;
  team: string;
  roleGroup: FantaRoleGroup;
}

export function fantacalcioRoleToGroup(role: string): FantaRoleGroup | null {
  if (role === "P") return "goalkeeper";
  if (role === "D") return "defender";
  if (role === "C") return "midfielder";
  if (role === "A") return "forward";
  return null;
}

function fantaKey(value: string): string {
  return normalizePlayerNameKey(value)
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTeamDecorations(name: string): string {
  return fantaKey(name)
    .replace(/\b(AC|AS|FC|CFC|SSC|SS|US|SSD|BC|SCF|CALCIO|CLUB)\b/g, " ")
    .replace(/\b(18|19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CANONICAL_TEAMS = new Set<string>();

export function normalizeFantaTeamKey(name: string): string {
  const stripped = stripTeamDecorations(name);
  if (!stripped) return "";
  if (stripped.includes("INTERNAZIONALE") || /(^|\s)INTER(\s|$)/.test(stripped)) return "INTER";
  if (stripped === "HELLAS VERONA" || stripped === "HELLAS" || stripped === "VERONA") return "VERONA";
  if (stripped === "MILAN" || stripped.endsWith(" MILAN")) return "MILAN";
  if (CANONICAL_TEAMS.has(stripped)) return stripped;
  const first = stripped.split(" ")[0] ?? "";
  if (first.length >= 4 && CANONICAL_TEAMS.has(first)) return first;
  for (const team of CANONICAL_TEAMS) {
    if (stripped.startsWith(`${team} `) || team.startsWith(`${stripped} `)) return team;
  }
  return stripped;
}

export function fantaTeamsMatch(a: string, b: string): boolean {
  const left = normalizeFantaTeamKey(a);
  const right = normalizeFantaTeamKey(b);
  return Boolean(left && right && left === right);
}

function parseQuoteName(name: string): { stem: string; initial: string | null } {
  const key = fantaKey(name);
  const parts = key.split(" ").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const skipInitial = new Set(["VAN", "DER", "DE", "DEL", "DI", "DA", "LA", "LO"]);
  if (parts.length >= 2 && last.length <= 3 && !skipInitial.has(last)) {
    return { stem: parts.slice(0, -1).join(" "), initial: last };
  }
  return { stem: key, initial: null };
}

function tokens(name: string): string[] {
  return fantaKey(name).split(" ").filter(Boolean);
}

function initialMatches(apiName: string, initial: string): boolean {
  const apiTokens = tokens(apiName);
  const stemLast = apiTokens[apiTokens.length - 1] ?? "";
  const given = apiTokens.filter((token) => token !== stemLast);
  if (!given.length) return false;
  return given.some((token) => token.startsWith(initial));
}

function stemMatches(apiName: string, stem: string): boolean {
  const api = fantaKey(apiName);
  const stemParts = stem.split(" ").filter(Boolean);
  if (!stemParts.length) return false;
  if (api === stem) return true;
  return stemParts.every((part) => api.includes(part));
}

const LIST: FantacalcioQuotation[] = (quotations as Array<{ id: string; role: string; mantra: string; name: string; team: string }>)
  .map((row) => {
    const roleGroup = fantacalcioRoleToGroup(row.role);
    if (!roleGroup || (row.role !== "P" && row.role !== "D" && row.role !== "C" && row.role !== "A")) {
      return null;
    }
    return {
      id: row.id,
      role: row.role,
      mantra: row.mantra,
      name: row.name,
      team: row.team,
      roleGroup
    };
  })
  .filter((row): row is FantacalcioQuotation => row != null);

for (const row of LIST) {
  CANONICAL_TEAMS.add(fantaKey(row.team));
}

export function listFantacalcioQuotations(): FantacalcioQuotation[] {
  return LIST;
}

/**
 * Abbina un giocatore FootAPI alla lista ufficiale Fantacalcio 2026/27 (nome + squadra).
 * I ruoli P/D/C/A e mantra (RM) arrivano dal listone, non dal ruolo tattico FootAPI.
 */
export function resolveFantacalcioQuotation(
  playerName: string,
  teamName?: string | null
): FantacalcioQuotation | null {
  const teamKey = teamName?.trim() ? normalizeFantaTeamKey(teamName) : "";
  const pool = teamKey ? LIST.filter((row) => fantaTeamsMatch(row.team, teamName ?? "")) : LIST;
  const scoped = pool.length ? pool : LIST;

  let best: { row: FantacalcioQuotation; score: number } | null = null;
  for (const row of scoped) {
    const parsed = parseQuoteName(row.name);
    if (!stemMatches(playerName, parsed.stem)) continue;
    if (parsed.initial && !initialMatches(playerName, parsed.initial)) continue;
    let score = parsed.initial ? 40 : 20;
    if (teamKey && fantaTeamsMatch(row.team, teamName ?? "")) score += 15;
    if (fantaKey(playerName) === fantaKey(row.name)) score += 25;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

export function searchFantacalcioQuotations(query: string, limit = 20): FantacalcioQuotation[] {
  const q = fantaKey(query);
  if (q.length < 2) return [];
  return LIST.filter((row) => fantaKey(row.name).includes(q) || fantaKey(row.team).includes(q)).slice(0, limit);
}
