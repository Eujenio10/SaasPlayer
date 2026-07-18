import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { combinePersistedOrganizationMenuSnapshots } from "../lib/tactical-matches-filters";
import type { UpcomingMatchItem } from "../services/sportapi";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
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
}

loadEnvLocal();

const org = process.env.PITCHBRAIN_PUBLIC_ORG_ID?.trim() ?? "";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

async function main() {
  const { data: intlRow } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", org)
    .maybeSingle();
  const intl = (Array.isArray(intlRow?.matches) ? intlRow.matches : []) as UpcomingMatchItem[];
  console.log("intl raw:", intl.length);
  for (const m of intl.slice(0, 3)) {
    console.log(
      m.eventId,
      m.competitionSlug,
      m.startTimestamp,
      new Date(m.startTimestamp * 1000).toISOString()
    );
  }

  const merged = combinePersistedOrganizationMenuSnapshots([], intl);
  console.log("after combine filter:", merged.length);
  console.log("now", Math.floor(Date.now() / 1000), new Date().toISOString());
}

main().catch(console.error);
