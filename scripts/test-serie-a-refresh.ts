/**
 * Esegue l'admin refresh reale (start -> insights -> finalize) limitato a "serie-a"
 * e verifica che tutti gli snapshot delle 4 funzioni vengano popolati correttamente.
 * Uso: npx tsx scripts/test-serie-a-refresh.ts
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

function summary(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "OK" : "FAIL"}  ${label}: ${detail}`);
}

async function main() {
  const { resolveProductOrganizationId } = await import("@/lib/auth/product-organization");
  const { runAdminMatchesRefresh } = await import("@/lib/mobile/admin-refresh-matches");
  const { createSupabaseServiceClient } = await import("@/lib/supabase/service-client");

  const organizationId = await resolveProductOrganizationId();
  if (!organizationId) {
    console.error("Impossibile risolvere organizationId prodotto.");
    process.exit(2);
  }
  console.log(`\n=== Test refresh admin scope=serie-a org=${organizationId} ===\n`);

  let phase: "start" | "insights" | "finalize" = "start";
  let insightsOffset = 0;
  let insightsSnap: number | undefined;
  let guard = 0;
  let insightsProcessedTotal = 0;
  let insightsTotal = 0;
  let lastResult: Awaited<ReturnType<typeof runAdminMatchesRefresh>> | null = null;

  while (guard < 50) {
    guard += 1;
    const result = await runAdminMatchesRefresh(organizationId, {
      trigger: "admin_manual",
      phase,
      insightsOffset,
      insightsSnap,
      competitionSlug: "serie-a"
    });
    lastResult = result;
    if (!result.ok) {
      console.error("refresh_failed", result.error);
      process.exit(3);
    }
    if (typeof result.insightsSnap === "number") insightsSnap = result.insightsSnap;
    if (phase === "insights") {
      insightsProcessedTotal += result.insightsProcessed;
      insightsTotal = result.insightsTotal;
      console.log(
        `  insights batch: +${result.insightsProcessed} (offset ora ${result.nextInsightsOffset}/${result.insightsTotal})` +
          (result.currentMatchLabel ? ` ultima: ${result.currentMatchLabel}` : "")
      );
    }
    if (phase === "start") {
      console.log(
        `  start: domestic=${result.domesticMatchesCount} scoped_targets=${result.insightsTotal}`
      );
    }
    if (result.done) break;
    phase = result.nextPhase ?? "finalize";
    insightsOffset = result.nextInsightsOffset ?? insightsOffset;
  }

  summary(
    "insights_phase",
    insightsTotal > 0 && insightsProcessedTotal > 0,
    `processate ${insightsProcessedTotal} di ${insightsTotal} partite Serie A`
  );

  if (lastResult) {
    console.log("\n--- Risultato finalize ---");
    console.log({
      trendsCount: lastResult.trendsCount,
      markingsCount: lastResult.markingsCount,
      playerPerformanceCount: lastResult.playerPerformanceCount,
      matchSimulatorCount: lastResult.matchSimulatorCount
    });
  }

  const supabase = createSupabaseServiceClient();

  const { data: menuRow } = await supabase
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const serieAMatches = ((menuRow?.matches as Array<{ competitionSlug?: string; eventId?: number }>) ?? []).filter(
    (m) => (m.competitionSlug ?? "").toLowerCase().includes("serie-a") || (m.competitionSlug ?? "").toLowerCase().includes("italy")
  );
  const serieAEventIds = serieAMatches.map((m) => m.eventId).filter((id): id is number => Boolean(id));
  summary("menu_serie_a", serieAEventIds.length > 0, `${serieAEventIds.length} partite Serie A nel menu`);

  if (serieAEventIds.length > 0) {
    const { data: insightsRows } = await supabase
      .from("kiosk_organization_match_insights")
      .select("event_id,metrics")
      .eq("organization_id", organizationId)
      .in("event_id", serieAEventIds);
    const withMetrics = (insightsRows ?? []).filter(
      (r) => Array.isArray(r.metrics) && (r.metrics as unknown[]).length > 0
    );
    summary(
      "match_insights",
      withMetrics.length > 0,
      `${withMetrics.length}/${serieAEventIds.length} partite Serie A con metriche giocatore salvate`
    );

    const { data: perfRow } = await supabase
      .from("organization_player_performance_snapshot")
      .select("matches")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const perfMatches = (perfRow?.matches as Record<string, unknown>) ?? {};
    const perfSerieACount = serieAEventIds.filter((id) => String(id) in perfMatches).length;
    summary(
      "player_performance_snapshot",
      perfSerieACount > 0,
      `${perfSerieACount}/${serieAEventIds.length} partite Serie A presenti nello snapshot player-performance`
    );

    const { data: markingsRow } = await supabase
      .from("organization_difficult_markings_snapshot")
      .select("snapshot")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const matchupIndex =
      ((markingsRow?.snapshot as { matchupIndex?: Record<string, unknown> } | null)?.matchupIndex) ?? {};
    summary(
      "difficult_markings_snapshot",
      Object.keys(matchupIndex).length > 0,
      `${Object.keys(matchupIndex).length} scontri totali nello snapshot marcature (tutti i campionati)`
    );

    const { data: trendsRow } = await supabase
      .from("organization_trends_snapshot")
      .select("snapshot")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const trendIndex =
      ((trendsRow?.snapshot as { trendIndex?: Record<string, unknown> } | null)?.trendIndex) ?? {};
    summary(
      "trends_snapshot",
      Object.keys(trendIndex).length > 0,
      `${Object.keys(trendIndex).length} trend totali nello snapshot (tutti i campionati)`
    );

    const { data: simRow } = await supabase
      .from("organization_match_simulator_snapshot")
      .select("snapshot")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const simIndex =
      ((simRow?.snapshot as { simulationIndex?: Record<string, unknown> } | null)?.simulationIndex) ?? {};
    const simSerieACount = serieAEventIds.filter((id) => String(id) in simIndex).length;
    summary(
      "match_simulator_snapshot",
      simSerieACount > 0,
      `${simSerieACount}/${serieAEventIds.length} simulazioni Serie A presenti (${Object.keys(simIndex).length} totali)`
    );
  }

  console.log("\n=== Fine test ===\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("test_crashed", error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
