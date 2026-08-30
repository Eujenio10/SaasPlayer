/**
 * Diagnostica marcature Serie A sullo snapshot insight reale.
 * Uso: npx tsx scripts/probe-serie-a-markings.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName: string): void {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  const { resolveProductOrganizationId } = await import("../lib/auth/product-organization");
  const { createSupabaseServiceClient } = await import("../lib/supabase/service-client");
  const { loadOrganizationUpcomingMenuMatches } = await import("../lib/trends/fixture-eligibility");
  const { resolveCompetitionId } = await import("../lib/competitions");
  const { buildProfilesFromMetrics } = await import("../lib/difficult-markings/profiles");
  const { computeDifficultMarkingsForMatch } = await import("../lib/difficult-markings/scoring");
  const { heatmapOverlap } = await import("../lib/difficult-markings/heatmap");
  const { profileActsAsAttacker, profileActsAsDefender } = await import("../lib/difficult-markings/roles");
  const { loadOrganizationDifficultMarkingsSnapshot } = await import("../lib/difficult-markings/snapshot");

  const orgId = await resolveProductOrganizationId();
  if (!orgId) {
    console.error("no org");
    process.exit(2);
  }
  const sb = createSupabaseServiceClient();
  const snap = await loadOrganizationDifficultMarkingsSnapshot(orgId);
  const serieRounds = (snap?.rounds ?? []).filter((r) => r.competitionId === "serie-a");
  console.log("org", orgId);
  console.log(
    "snapshot updated",
    snap?.updatedAt,
    "serie-a rounds",
    serieRounds.length,
    "serie-a results",
    serieRounds.reduce((s, r) => s + r.results.length, 0)
  );

  const menu = await loadOrganizationUpcomingMenuMatches(orgId);
  const serie = menu.filter((m) => resolveCompetitionId(m.competitionSlug) === "serie-a");
  console.log("upcoming serie-a matches", serie.length);

  const eventIds = serie.map((m) => m.eventId).filter((id) => id > 0);
  const { data, error } = await sb
    .from("kiosk_organization_match_insights")
    .select("event_id,metrics")
    .eq("organization_id", orgId)
    .in("event_id", eventIds);
  if (error) {
    console.error(error);
    process.exit(3);
  }

  const metricsByEvent = new Map<number, any[]>();
  for (const row of data ?? []) {
    const eventId = typeof row.event_id === "number" ? row.event_id : 0;
    const metrics = Array.isArray(row.metrics) ? row.metrics : [];
    if (eventId > 0) metricsByEvent.set(eventId, metrics);
  }

  for (const match of serie) {
    const metrics = metricsByEvent.get(match.eventId) ?? [];
    const withHm = metrics.filter((m) => (m.heatmapPointsMatchFrame?.length ?? 0) >= 3).length;
    const profiles = buildProfilesFromMetrics({
      metrics,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id
    });
    const defenders = profiles.filter((p) => profileActsAsDefender(p));
    const attackers = profiles.filter((p) => profileActsAsAttacker(p));
    const oppFoulOk = profiles.filter((p) => p.roleIcon !== "🧤" && (p.foulsDrawnPer90 ?? 0) >= 1);

    const loadAt = new Map<string, Array<{ name: string; pct: number; fouls: number }>>();
    const overlaps: number[] = [];

    for (const defender of defenders) {
      for (const attacker of oppFoulOk) {
        if (defender.teamId === attacker.teamId) continue;
        const ag = attacker.offensiveHeatmap;
        const dg = defender.offensiveHeatmap ?? defender.defensiveHeatmap;
        if (!ag?.length || !dg?.length) continue;
        if ((defender.heatmapPointsMatchFrame?.length ?? 0) < 3) continue;
        if ((attacker.heatmapPointsMatchFrame?.length ?? 0) < 3) continue;
        const overlap = heatmapOverlap(ag, dg);
        overlaps.push(overlap);
        const pct = Math.round(overlap * 100);
        if (pct < 16) continue;
        const list = loadAt.get(defender.playerId) ?? [];
        list.push({
          name: attacker.playerName,
          pct,
          fouls: attacker.foulsDrawnPer90 ?? 0
        });
        loadAt.set(defender.playerId, list);
      }
    }

    overlaps.sort((a, b) => b - a);
    const duals = [...loadAt.entries()]
      .map(([id, list]) => {
        const def = defenders.find((d) => d.playerId === id);
        return { def: def?.playerName, role: def?.normalizedRole, n: list.length, list };
      })
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.n - a.n);

    const published = computeDifficultMarkingsForMatch({
      match,
      profiles,
      percentilePool: profiles,
      competitionId: "serie-a",
      roundKey: "probe"
    });

    console.log("\n==", match.homeTeam.name, "vs", match.awayTeam.name, "metrics", metrics.length);
    console.log(
      " heatmap",
      withHm,
      "def",
      defenders.length,
      "att",
      attackers.length,
      "oppFouls>=1",
      oppFoulOk.length,
      oppFoulOk.map((p) => `${p.playerName} ${p.normalizedRole} ${(p.foulsDrawnPer90 ?? 0).toFixed(1)}`).join(", ")
    );
    console.log(
      " top overlaps",
      overlaps.slice(0, 8).map((v) => Math.round(v * 100) + "%").join(", ") || "(none)"
    );
    console.log(
      " dual@16%+",
      duals.length
        ? duals
            .map(
              (d) =>
                `${d.def} (${d.role}) -> ` +
                d.list.map((x) => `${x.name} ${x.pct}% fs${x.fouls.toFixed(1)}`).join(" + ")
            )
            .join(" || ")
        : "(none)"
    );
    console.log(
      " published",
      published.length,
      published
        .map(
          (m) =>
            `${m.defenderPlayerName} load=${m.markingLoadCount} score=${m.difficultMarkingScore} ov=${m.heatmapOverlapPct}`
        )
        .join(" | ") || "(none)"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
