/**
 * Diagnostica elenco Simulatore match (Mondiali).
 * node scripts/diagnose-simulator-fixtures.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

function normalizeRows(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item;
    const eventId = Number(row.eventId);
    const startTimestamp = Number(row.startTimestamp);
    const homeId = Number(row.homeTeam?.id);
    const awayId = Number(row.awayTeam?.id);
    const slug = typeof row.competitionSlug === "string" ? row.competitionSlug : "";
    if (!eventId || !homeId || !awayId || !slug) continue;
    out.push({
      eventId,
      startTimestamp: Number.isFinite(startTimestamp) ? startTimestamp : 0,
      competitionSlug: slug,
      competitionName: row.competitionName ?? slug,
      homeTeam: row.homeTeam?.name,
      awayTeam: row.awayTeam?.name
    });
  }
  return out;
}

const now = Math.floor(Date.now() / 1000);

const { data: intlOrgs } = await sb
  .from("organization_international_matches_snapshot")
  .select("organization_id, updated_at, matches")
  .order("updated_at", { ascending: false })
  .limit(5);

console.log("=== organization_international_matches_snapshot ===");
for (const row of intlOrgs ?? []) {
  const raw = normalizeRows(row.matches);
  const future = raw.filter((m) => m.startTimestamp > now);
  const slugs = [...new Set(raw.map((m) => m.competitionSlug))];
  console.log({
    org: row.organization_id?.slice(0, 8),
    updated_at: row.updated_at,
    raw: raw.length,
    future: future.length,
    slugs: slugs.slice(0, 5),
    sample: raw[0]
      ? `${raw[0].homeTeam} vs ${raw[0].awayTeam} | ${raw[0].competitionSlug} | ts=${raw[0].startTimestamp}`
      : null
  });
}

const { data: markings } = await sb
  .from("organization_difficult_markings_snapshot")
  .select("organization_id, updated_at, snapshot")
  .order("updated_at", { ascending: false })
  .limit(3);

console.log("\n=== organization_difficult_markings_snapshot ===");
for (const row of markings ?? []) {
  const snap = row.snapshot ?? {};
  const index = snap.matchupIndex ?? {};
  const keys = Object.keys(index);
  const wc = keys.filter((k) => {
    const m = index[k];
    const c = String(m?.competitionId ?? "").toLowerCase();
    return c.includes("world") || c === "world-cup";
  });
  const futureWc = wc.filter((k) => (index[k]?.kickoffTimestamp ?? 0) > now);
  console.log({
    org: row.organization_id?.slice(0, 8),
    updated_at: row.updated_at,
    matchups: keys.length,
    worldCupMatchups: wc.length,
    futureWorldCup: futureWc.length,
    sampleWc: wc[0] ? index[wc[0]] : null
  });
}

const { data: menuOrgs } = await sb
  .from("organization_matches_menu_snapshot")
  .select("organization_id, updated_at")
  .order("updated_at", { ascending: false })
  .limit(3);
console.log("\n=== organization_matches_menu_snapshot (latest) ===");
console.log(menuOrgs);

// Simula pipeline simulatore (senza import TypeScript)
function looksLikeWorldCupLabel(raw) {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return false;
  if (s.includes("world cup") || s.includes("worldcup")) return true;
  if (s.includes("mondial") || s.includes("coppa del mondo")) return true;
  if (s.includes("fifa") && s.includes("world")) return true;
  if (s.includes("world-cup") || s.includes("worldcup") || s.includes("world-championship")) return true;
  return false;
}

function resolveMatchCompetitionId(match) {
  if (looksLikeWorldCupLabel(match.competitionName) || looksLikeWorldCupLabel(match.competitionSlug)) {
    return "world-cup";
  }
  const slug = String(match.competitionSlug ?? "").toLowerCase();
  if (slug === "world-cup" || slug.includes("world-championship")) return "world-cup";
  return slug || null;
}

const latestIntl = intlOrgs?.[0];
if (latestIntl) {
  const rows = normalizeRows(latestIntl.matches);
  const future = rows.filter((m) => m.startTimestamp > now);
  const wc = future.filter((m) => resolveMatchCompetitionId(m) === "world-cup");
  console.log("\n=== Simulated WC fixtures from latest intl snapshot ===");
  console.log({ future: future.length, worldCup: wc.length, samples: wc.slice(0, 3) });
}
