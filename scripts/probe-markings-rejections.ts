import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  estimatedMarkingZoneGrids,
  heatmapOverlap
} from "../lib/difficult-markings/heatmap";
import { buildProfilesFromMetrics } from "../lib/difficult-markings/profiles";
import {
  profileActsAsAttacker,
  profileActsAsDefender,
  rolesAreCompatible,
  roleCompatibilityScore
} from "../lib/difficult-markings/roles";
import type { PlayerRecentProfile } from "../lib/difficult-markings/types";
import type { TacticalMetrics } from "../lib/types";
import type { UpcomingMatchItem } from "../services/sportapi";

const MATCHUP_THRESHOLD = 0.58;
const MIN_ATTACKER_THREAT = 0.45;
const MIN_ATTACKER_FOULS_DRAWN = 1.35;

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

function formationPositionScore(attacker: PlayerRecentProfile, defender: PlayerRecentProfile): number {
  if (attacker.formationSide !== "center" && defender.formationSide !== "center") {
    if (attacker.formationSide === "left" && defender.formationSide === "right") return 0.92;
    if (attacker.formationSide === "right" && defender.formationSide === "left") return 0.92;
    return 0.35;
  }
  if (attacker.formationSide === "center" && defender.formationSide === "center") return 0.78;
  return 0.55;
}

function attackerHasMeaningfulOffensiveProfile(attacker: PlayerRecentProfile): boolean {
  const foulsDrawn = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  return foulsDrawn >= MIN_ATTACKER_FOULS_DRAWN || dribblesOk >= 0.95 || dribblesAtt >= 2.2;
}

function meetsSampleRequirement(player: PlayerRecentProfile): boolean {
  if (player.sampleMatches >= 5 && player.sampleMinutes >= 450) return true;
  const hasRealMetrics =
    (player.foulsDrawnPer90 ?? 0) >= 0.8 ||
    (player.foulsCommittedPer90 ?? 0) >= 0.8 ||
    (player.dribblesAttemptedPer90 ?? 0) >= 1.5;
  return hasRealMetrics && player.sampleMatches >= 3 && player.sampleMinutes >= 270;
}

loadEnvLocal();

const org = process.env.PITCHBRAIN_PUBLIC_ORG_ID?.trim() ?? "";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

async function diagnoseMatch(match: UpcomingMatchItem, metrics: TacticalMetrics[]) {
  const profiles = buildProfilesFromMetrics({
    metrics,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id
  });
  const lookup = null;
  const defenders = profiles.filter((p) => profileActsAsDefender(p));
  const attackers = profiles.filter((p) => profileActsAsAttacker(p));

  const counts: Record<string, number> = {
    sameTeam: 0,
    roleIncompatible: 0,
    lowMatchupScore: 0,
    lowAttackerThreat: 0,
    weakAttackerProfile: 0,
    sampleFail: 0,
    lowDifficultScore: 0,
    lowReliability: 0,
    passed: 0
  };

  let bestMatchup = 0;
  let bestThreat = 0;

  for (const defender of defenders) {
    for (const attacker of attackers) {
      if (defender.teamId === attacker.teamId) {
        counts.sameTeam++;
        continue;
      }
      if (!rolesAreCompatible(attacker.normalizedRole, defender.normalizedRole)) {
        counts.roleIncompatible++;
        continue;
      }

      const estimated = estimatedMarkingZoneGrids(attacker.formationSide, defender.formationSide);
      const overlap = heatmapOverlap(estimated.attackerGrid, estimated.defenderGrid);
      const roleScore = roleCompatibilityScore(attacker.normalizedRole, defender.normalizedRole);
      const formationScore = formationPositionScore(attacker, defender);
      const matchupScore = Math.min(1, 0.5 * roleScore + 0.32 * formationScore + 0.18 * 0.55);
      bestMatchup = Math.max(bestMatchup, matchupScore);
      if (matchupScore < MATCHUP_THRESHOLD) {
        counts.lowMatchupScore++;
        continue;
      }

      const foulsDrawn = attacker.foulsDrawnPer90 ?? 0;
      const threat = Math.min(1, foulsDrawn / 3.2) * 0.4 + 0.3; // rough
      bestThreat = Math.max(bestThreat, threat);
      if (threat < MIN_ATTACKER_THREAT) {
        counts.lowAttackerThreat++;
        continue;
      }
      if (!attackerHasMeaningfulOffensiveProfile(attacker)) {
        counts.weakAttackerProfile++;
        continue;
      }
      if (!meetsSampleRequirement(attacker) || !meetsSampleRequirement(defender)) {
        counts.sampleFail++;
        continue;
      }

      counts.passed++;
    }
  }

  console.log("\n", match.homeTeam.name, "vs", match.awayTeam.name, `(event ${match.eventId})`);
  console.log(" attackers", attackers.length, "defenders", defenders.length);
  console.log(" best estimated matchupScore", bestMatchup.toFixed(3), "threshold", MATCHUP_THRESHOLD);
  console.log(" rejections:", counts);
}

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

  for (const match of intl.slice(0, 4)) {
    const metrics = metricsByEvent.get(match.eventId);
    if (!metrics?.length) continue;
    await diagnoseMatch(match, metrics);
  }
}

main().catch(console.error);
