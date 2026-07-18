/**
 * Verifica integrità dati Player Performance.
 * Esegui: npx tsx scripts/verify-player-performance-data.ts [eventId]
 */

import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const envText = fs.readFileSync(path.join(root, ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const eventId = Number(process.argv[2] || "12812994");

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "0%";
}

async function main() {
  const { createSupabaseServiceClient } = await import("../lib/supabase/service-client");
  const { buildMatchPlayerPerformance } = await import("../lib/player-performance/build");
  const { aggregatePlayerAppearances, toPerformanceMetrics } = await import(
    "../lib/player-performance/aggregate"
  );
  const { calculatePer90 } = await import("../lib/player-performance/per90");
  const { loadTeamMatchPlayerStats, loadRecentTeamMatchIdsFromCache } = await import(
    "../lib/trends/persist"
  );

  console.log("=== VERIFICA DATI PLAYER PERFORMANCE ===\n");

  console.log("1) Schema colonne estese");
  const sb = createSupabaseServiceClient();
  const extended = [
    "goals",
    "assists",
    "key_passes",
    "dribbles_attempts",
    "dribbles_success",
    "match_rating"
  ];
  for (const col of extended) {
    const { error } = await sb.from("player_match_trend_stats").select(col).limit(1);
    console.log(error ? `  ✗ '${col}': ${error.message}` : `  ✓ '${col}' presente`);
  }

  const { data, error, count } = await sb
    .from("player_match_trend_stats")
    .select(
      "match_id, player_name, team_id, minutes_played, shots, shots_on_target, goals, assists, key_passes, dribbles_success, match_date",
      { count: "exact" }
    )
    .gt("minutes_played", 0)
    .order("match_date", { ascending: false })
    .limit(8);

  console.log(`\n=== Campione DB (totale tabella: ${count ?? "?"}) ===`);
  if (error) {
    console.log("Errore:", error.message);
  } else {
    for (const row of data ?? []) {
      console.log(
        `  ${row.player_name} | match ${row.match_id} | ${row.minutes_played}' | tiri ${row.shots ?? "-"} | TIP ${row.shots_on_target ?? "-"} | gol ${row.goals ?? "-"} | ass ${row.assists ?? "-"} | kP ${row.key_passes ?? "-"} | drib ${row.dribbles_success ?? "-"}`
      );
    }
  }

  const { data: coverage } = await sb
    .from("player_match_trend_stats")
    .select("goals, assists, key_passes, dribbles_success")
    .gt("minutes_played", 0)
    .limit(500);

  if (coverage?.length) {
    const n = coverage.length;
    console.log("\n=== Copertura campi (ultimi 500 record con minuti) ===");
    console.log(`  goals:            ${coverage.filter((r) => r.goals != null).length}/${n}`);
    console.log(`  assists:          ${coverage.filter((r) => r.assists != null).length}/${n}`);
    console.log(`  key_passes:       ${coverage.filter((r) => r.key_passes != null).length}/${n}`);
    console.log(`  dribbles_success: ${coverage.filter((r) => r.dribbles_success != null).length}/${n}`);
  }

  const { data: per90Row } = await sb
    .from("player_match_trend_stats")
    .select("*")
    .gt("minutes_played", 30)
    .not("shots", "is", null)
    .limit(1)
    .maybeSingle();

  if (per90Row) {
    const minutes = per90Row.minutes_played as number;
    const shots = per90Row.shots as number;
    const expected = calculatePer90(shots, minutes);
    const manual = minutes > 0 ? (shots / minutes) * 90 : 0;
    console.log("\n=== Verifica formula per90 ===");
    console.log(`  ${per90Row.player_name}: ${shots} tiri in ${minutes}' → ${manual.toFixed(2)}/90`);
    console.log(
      Math.abs(manual - expected) < 0.001 ? "  ✓ formula coerente" : "  ✗ formula errata"
    );
  }

  console.log(`\n=== Build output (eventId=${eventId}) ===`);
  const { data: menuDomestic } = await sb
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", "11111111-1111-1111-1111-111111111111")
    .maybeSingle();
  const { data: menuIntl } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", "11111111-1111-1111-1111-111111111111")
    .maybeSingle();

  const allMatches = [
    ...(Array.isArray(menuDomestic?.matches) ? menuDomestic.matches : []),
    ...(Array.isArray(menuIntl?.matches) ? menuIntl.matches : [])
  ] as Array<{
    eventId?: number;
    homeTeam?: { id: number; name: string };
    awayTeam?: { id: number; name: string };
  }>;

  const match = allMatches.find((m) => m.eventId === eventId);
  const hints =
    match?.homeTeam?.id && match?.awayTeam?.id
      ? {
          homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name ?? "Home" },
          awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name ?? "Away" }
        }
      : undefined;

  if (hints) {
    console.log(`  Partita: ${hints.homeTeam.name} vs ${hints.awayTeam.name}`);
    const [homeCache, awayCache] = await Promise.all([
      loadRecentTeamMatchIdsFromCache({
        teamId: String(hints.homeTeam.id),
        excludeMatchId: String(eventId),
        limit: 10
      }),
      loadRecentTeamMatchIdsFromCache({
        teamId: String(hints.awayTeam.id),
        excludeMatchId: String(eventId),
        limit: 10
      })
    ]);
    console.log(`  Fixture in cache DB: home=${homeCache.length}, away=${awayCache.length}`);
  } else {
    console.log("  Partita non trovata nel menu org — build senza hint squadre");
  }

  const payload = await buildMatchPlayerPerformance(eventId, hints);
  if (!payload) {
    console.log("  ✗ Nessun payload (contesto partita non risolvibile o DB vuoto)");
    return;
  }

  console.log(`  ✓ Payload OK | partite analizzate: ${payload.matchesAnalyzed}`);
  console.log(`  Warning: ${payload.warnings.join(" | ") || "nessuno"}`);
  console.log(
    `  Coverage API: tiri=${payload.coverage.shots} TIP=${payload.coverage.shotsOnTarget} kP=${payload.coverage.keyPasses} drib=${payload.coverage.dribbles}`
  );

  for (const side of ["homeTeam", "awayTeam"] as const) {
    const team = payload[side];
    console.log(`\n  --- ${team.teamName} ---`);
    console.log(
      `  Pericolosi ${team.dangerousPlayers.length} | Crescita ${team.risingPlayers.length} | Calo ${team.decliningPlayers.length}`
    );
    for (const p of team.dangerousPlayers.slice(0, 3)) {
      const s = p.combined ?? p.recent;
      console.log(
        `    [DI ${p.dangerIndex}] ${p.playerName} (${p.roleGroup}) — ${s.shotsPer90} tiri/90, ${s.shotsOnTargetPer90} TIP/90, ${p.recent.minutes + (p.baseline?.minutes ?? 0)}'`
      );
    }
  }

  if (hints && payload.homeTeam.dangerousPlayers.length) {
    const top = payload.homeTeam.dangerousPlayers[0];
    const matchIds = await loadRecentTeamMatchIdsFromCache({
      teamId: String(hints.homeTeam.id),
      excludeMatchId: String(eventId),
      limit: 10
    });
    const rows = await loadTeamMatchPlayerStats({
      teamId: String(hints.homeTeam.id),
      matchIds
    });
    const playerRows = rows.filter((r) => r.playerId === String(top.playerId));
    const metrics = toPerformanceMetrics(aggregatePlayerAppearances(playerRows));
    const sample = top.combined ?? top.recent;
    const ok = Math.abs(metrics.shotsPer90 - sample.shotsPer90) < 0.15;
    console.log(
      `\n  Cross-check DB vs UI (${top.playerName}): ${metrics.shotsPer90} vs ${sample.shotsPer90} tiri/90 → ${ok ? "✓ coerente" : "✗ divergenza"}`
    );
  }

  console.log("\n=== FINE VERIFICA ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
