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

async function main() {
  console.log("PITCHBRAIN_PUBLIC_ORG_ID:", publicOrg ?? "(unset)");

  const { data: rows, error } = await sb
    .from("organization_trends_snapshot")
    .select("organization_id,snapshot,updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("read error:", error.message);
    process.exit(1);
  }

  for (const row of rows ?? []) {
    const snap = row.snapshot ?? {};
    const indexCount = Object.keys(snap.trendIndex ?? {}).length;
    const competitions = new Set();
    for (const r of snap.rounds ?? []) competitions.add(r.competitionId);
    for (const t of Object.values(snap.trendIndex ?? {})) competitions.add(t.competitionId);

    console.log("\n--- org", row.organization_id, "---");
    console.log("updated_at:", row.updated_at);
    console.log("trendIndex keys:", indexCount);
    console.log("rounds:", snap.rounds?.length ?? 0);
    console.log("competitions:", [...competitions]);
  }

  if (publicOrg) {
    const now = Math.floor(Date.now() / 1000);
    const { data: menuIntl } = await sb
      .from("organization_international_matches_snapshot")
      .select("matches")
      .eq("organization_id", publicOrg)
      .maybeSingle();
    const kickMap = new Map();
    for (const m of menuIntl?.matches ?? []) {
      if (m.startTimestamp > 0) kickMap.set(String(m.eventId), m.startTimestamp);
    }
    const { data: trow } = await sb
      .from("organization_trends_snapshot")
      .select("snapshot")
      .eq("organization_id", publicOrg)
      .maybeSingle();
    const trends = Object.values(trow?.snapshot?.trendIndex ?? {});
    let future = 0;
    let past = 0;
    let missing = 0;
    for (const tr of trends) {
      const k = tr.kickoffTimestamp > 0 ? tr.kickoffTimestamp : kickMap.get(String(tr.fixtureId));
      if (!k) missing++;
      else if (k > now) future++;
      else past++;
    }
    console.log("\n--- kickoff eligibility (public org) ---");
    console.log("trends total:", trends.length, "future:", future, "past:", past, "missing:", missing);
    console.log("intl menu events:", (menuIntl?.matches ?? []).map((m) => m.eventId));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
