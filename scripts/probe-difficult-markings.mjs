import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicOrg = process.env.PITCHBRAIN_PUBLIC_ORG_ID?.trim();

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function countStored(snapshot) {
  const indexCount = Object.keys(snapshot?.matchupIndex ?? {}).length;
  if (indexCount > 0) return indexCount;
  return (snapshot?.rounds ?? []).reduce((s, r) => s + (r.results?.length ?? 0), 0);
}

function preMatchFilter(items) {
  const now = nowSeconds();
  return items.filter((m) => m.kickoffTimestamp > 0 && m.kickoffTimestamp > now);
}

async function main() {
  console.log("PITCHBRAIN_PUBLIC_ORG_ID:", publicOrg ?? "(unset)");

  const { data: rows, error } = await sb
    .from("organization_difficult_markings_snapshot")
    .select("organization_id,snapshot,updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("read error:", error.message);
    process.exit(1);
  }

  for (const row of rows ?? []) {
    const snap = row.snapshot ?? {};
    const total = countStored(snap);
    const competitions = new Set();
    for (const r of snap.rounds ?? []) {
      competitions.add(r.competitionId);
    }
    for (const m of Object.values(snap.matchupIndex ?? {})) {
      competitions.add(m.competitionId);
    }

    let sampleKickoff = null;
    let missingKickoff = 0;
    let pastKickoff = 0;
    let futureKickoff = 0;
    const all = [
      ...Object.values(snap.matchupIndex ?? {}),
      ...(snap.rounds ?? []).flatMap((r) => r.results ?? [])
    ];
    for (const m of all) {
      if (!m?.kickoffTimestamp) {
        missingKickoff++;
        continue;
      }
      if (m.kickoffTimestamp <= nowSeconds()) pastKickoff++;
      else futureKickoff++;
      if (!sampleKickoff) sampleKickoff = m.kickoffTimestamp;
    }

    const preMatch = preMatchFilter(all);
    console.log("\n--- org", row.organization_id, "---");
    console.log("updated_at:", row.updated_at);
    console.log("stored total:", total);
    console.log("rounds:", snap.rounds?.length ?? 0);
    console.log("matchupIndex keys:", Object.keys(snap.matchupIndex ?? {}).length);
    console.log("competitions:", [...competitions]);
    console.log("kickoff missing:", missingKickoff, "past:", pastKickoff, "future:", futureKickoff);
    console.log("pre-match after filter:", preMatch.length);
    if (sampleKickoff) {
      console.log("sample kickoff:", sampleKickoff, new Date(sampleKickoff * 1000).toISOString());
    }
    console.log("now:", nowSeconds(), new Date().toISOString());
  }

  const org = publicOrg ?? rows?.[0]?.organization_id;
  if (org) {
    const { count: insightsCount } = await sb
      .from("kiosk_organization_match_insights")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org);
    const { count: menuCount } = await sb
      .from("organization_matches_menu_snapshot")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org);
    console.log("\n--- catalog for public org ---");
    console.log("insights rows:", insightsCount);
    console.log("menu snapshot:", menuCount ? "yes" : "no");

    const { data: insightRows } = await sb
      .from("kiosk_organization_match_insights")
      .select("event_id,metrics")
      .eq("organization_id", org)
      .limit(3);
    for (const row of insightRows ?? []) {
      const metrics = Array.isArray(row.metrics) ? row.metrics : [];
      console.log("event", row.event_id, "players:", metrics.length);
    }

    const { data: menuRow } = await sb
      .from("organization_matches_menu_snapshot")
      .select("matches")
      .eq("organization_id", org)
      .maybeSingle();
    const menu = Array.isArray(menuRow?.matches) ? menuRow.matches : [];
    console.log("menu matches:", menu.length);
    const { data: intlRow } = await sb
      .from("organization_international_matches_snapshot")
      .select("matches")
      .eq("organization_id", org)
      .maybeSingle();
    const intl = Array.isArray(intlRow?.matches) ? intlRow.matches : [];
    console.log("international menu matches:", intl.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
