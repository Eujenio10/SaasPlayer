import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { computeDifficultMarkingsSnapshot } from "../lib/difficult-markings/compute";
import { buildProfilesFromMetrics } from "../lib/difficult-markings/profiles";
import { computeDifficultMarkingsForMatch } from "../lib/difficult-markings/scoring";
import {
  profileActsAsAttacker,
  profileActsAsDefender,
  rolesAreCompatible
} from "../lib/difficult-markings/roles";
import type { TacticalMetrics } from "../lib/types";
import type { UpcomingMatchItem } from "../services/sportapi";

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

  const { data: insightRows } = await sb
    .from("kiosk_organization_match_insights")
    .select("event_id,metrics")
    .eq("organization_id", org);

  const metricsByEvent = new Map<number, TacticalMetrics[]>();
  for (const row of insightRows ?? []) {
    const eventId = typeof row.event_id === "number" ? row.event_id : 0;
    const metrics = Array.isArray(row.metrics) ? (row.metrics as TacticalMetrics[]) : [];
    if (eventId > 0 && metrics.length) metricsByEvent.set(eventId, metrics);
  }

  const bundles = intl
    .map((match) => ({ match, metrics: metricsByEvent.get(match.eventId) ?? [] }))
    .filter((b) => b.metrics.length > 0);

  console.log("bundles:", bundles.length, "intl:", intl.length, "insights:", metricsByEvent.size);

  for (const bundle of bundles.slice(0, 2)) {
    const profiles = buildProfilesFromMetrics({
      metrics: bundle.metrics,
      homeTeamId: bundle.match.homeTeam.id,
      awayTeamId: bundle.match.awayTeam.id
    });
    const attackers = profiles.filter((p) => profileActsAsAttacker(p));
    const defenders = profiles.filter((p) => profileActsAsDefender(p));
    console.log("\nmatch", bundle.match.eventId, bundle.match.homeTeam.name, "vs", bundle.match.awayTeam.name);
    console.log("profiles", profiles.length, "attackers", attackers.length, "defenders", defenders.length);
    const withHeatmap = profiles.filter((p) => (p.heatmapPointCount ?? 0) >= 3).length;
    console.log("profiles with heatmap (>=3 pts):", withHeatmap);

    const foulDrawn = attackers.map((a) => a.foulsDrawnPer90 ?? 0).sort((a, b) => b - a);
    const foulCommit = defenders.map((d) => d.foulsCommittedPer90 ?? 0).sort((a, b) => b - a);
    console.log("top attacker foulsDrawnPer90:", foulDrawn.slice(0, 5));
    console.log("top defender foulsCommittedPer90:", foulCommit.slice(0, 5));

    let compatiblePairs = 0;
    for (const d of defenders) {
      for (const a of attackers) {
        if (d.teamId === a.teamId) continue;
        if (rolesAreCompatible(a.normalizedRole, d.normalizedRole)) compatiblePairs++;
      }
    }
    console.log("compatible cross-team pairs:", compatiblePairs);

    const raw = computeDifficultMarkingsForMatch({
      match: bundle.match,
      profiles,
      percentilePool: profiles,
      competitionId: "world-cup",
      roundKey: "probe"
    });
    console.log("raw matchups for this fixture:", raw.length);
    if (raw[0]) {
      console.log(" best score:", raw[0].difficultMarkingScore, "matchup:", raw[0].matchupScore);
    }
  }

  const snapshot = computeDifficultMarkingsSnapshot({
    bundles,
    insightsSnap: Math.floor(Date.now() / 1000)
  });

  const rawTotal = snapshot.rounds.reduce((s, r) => s + r.results.length, 0);
  const indexTotal = Object.keys(snapshot.matchupIndex ?? {}).length;
  console.log("\ncomputed rounds:", snapshot.rounds.length, "results:", rawTotal, "index:", indexTotal);
  for (const r of snapshot.rounds) {
    console.log(" round", r.competitionId, r.round, "results:", r.results.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
