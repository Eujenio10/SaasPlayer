/**
 * Probe live: verifica recupero stats giocatori + squadre + simulazione.
 * Uso: npx tsx scripts/probe-data-retrieval.ts
 * Opzionale: EVENT_ID=123456 npx tsx scripts/probe-data-retrieval.ts
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
  const { performanceRowHasRealSample } = await import("@/lib/analysis-unavailable");
  const { simulateFixture } = await import("@/lib/match-simulator/simulate");
  const {
    fetchEventMatchTeamsContext,
    fetchSportPerformanceForTeams,
    fetchTeamPerformanceBlueprint,
    fetchFootApiTeamFinishedEventsBroad
  } = await import("@/services/sportapi");

  async function resolveProbeEventId(): Promise<number> {
    const fromEnv = Number(
      process.env.EVENT_ID?.trim() || process.env.TACTICAL_DEFAULT_FIXTURE_ID?.trim() || ""
    );
    if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

    /** Juventus — una partita recente finita per probe stats (poche chiamate). */
    const juventusId = 2687;
    const events = await fetchFootApiTeamFinishedEventsBroad({
      teamId: juventusId,
      maxEvents: 3,
      maxPages: 1
    });
    const id = Number(events[0]?.id);
    if (Number.isFinite(id) && id > 0) return id;
    throw new Error("Impossibile risolvere un eventId di probe");
  }

  const eventId = await resolveProbeEventId();

  console.log(`\n=== Probe data retrieval eventId=${eventId} ===\n`);

  const ctx = await fetchEventMatchTeamsContext(eventId);
  if (!ctx) {
    summary("match_context", false, "fetchEventMatchTeamsContext ha restituito null");
    process.exit(2);
  }
  summary(
    "match_context",
    true,
    `${ctx.homeTeam.name} vs ${ctx.awayTeam.name} | tournament=${ctx.tournamentId} season=${ctx.seasonId} kickoff=${ctx.startTimestamp}`
  );

  const players = await fetchSportPerformanceForTeams({
    eventId,
    homeTeamId: ctx.homeTeam.id,
    homeTeamName: ctx.homeTeam.name,
    awayTeamId: ctx.awayTeam.id,
    awayTeamName: ctx.awayTeam.name,
    competitionSlug: "serie-a",
    tournamentId: ctx.tournamentId || undefined,
    seasonId: ctx.seasonId || undefined
  });

  const realPlayers = players.filter((row) => performanceRowHasRealSample(row));
  const homePlayers = realPlayers.filter((p) => p.teamId === ctx.homeTeam.id);
  const awayPlayers = realPlayers.filter((p) => p.teamId === ctx.awayTeam.id);
  const samplePlayer = realPlayers[0];

  summary(
    "player_stats",
    realPlayers.length > 0 && homePlayers.length > 0 && awayPlayers.length > 0,
    `total=${players.length} real=${realPlayers.length} home=${homePlayers.length} away=${awayPlayers.length}` +
      (samplePlayer
        ? ` | es. ${samplePlayer.athleteName} foulsC=${samplePlayer.foulsCommittedSeasonAvg?.toFixed?.(2) ?? samplePlayer.foulsCommittedSeasonAvg} shots=${samplePlayer.shotsSeasonAvg?.toFixed?.(2) ?? samplePlayer.shotsSeasonAvg}`
        : "")
  );

  let homeBpOk = false;
  let awayBpOk = false;
  try {
    const homeBp = await fetchTeamPerformanceBlueprint({
      teamId: ctx.homeTeam.id,
      teamName: ctx.homeTeam.name,
      scope: "DOMESTIC",
      competitionSlug: "serie-a",
      tournamentId: ctx.tournamentId || undefined,
      seasonId: ctx.seasonId || undefined
    });
    homeBpOk = Boolean(
      homeBp &&
        ((homeBp.offensive?.shotsOn ?? 0) > 0 ||
          (homeBp.defensive?.shotsConceded ?? 0) > 0 ||
          (homeBp.offensive?.possession ?? 0) > 0)
    );
    summary(
      "team_blueprint_home",
      homeBpOk,
      `shotsOn=${homeBp.offensive?.shotsOn ?? 0} shotsConceded=${homeBp.defensive?.shotsConceded ?? 0} poss=${homeBp.offensive?.possession ?? 0}`
    );
  } catch (e) {
    summary("team_blueprint_home", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const awayBp = await fetchTeamPerformanceBlueprint({
      teamId: ctx.awayTeam.id,
      teamName: ctx.awayTeam.name,
      scope: "DOMESTIC",
      competitionSlug: "serie-a",
      tournamentId: ctx.tournamentId || undefined,
      seasonId: ctx.seasonId || undefined
    });
    awayBpOk = Boolean(
      awayBp &&
        ((awayBp.offensive?.shotsOn ?? 0) > 0 ||
          (awayBp.defensive?.shotsConceded ?? 0) > 0 ||
          (awayBp.offensive?.possession ?? 0) > 0)
    );
    summary(
      "team_blueprint_away",
      awayBpOk,
      `shotsOn=${awayBp.offensive?.shotsOn ?? 0} shotsConceded=${awayBp.defensive?.shotsConceded ?? 0} poss=${awayBp.offensive?.possession ?? 0}`
    );
  } catch (e) {
    summary("team_blueprint_away", false, e instanceof Error ? e.message : String(e));
  }

  const sim = await simulateFixture({
    match: {
      eventId,
      competitionSlug: "serie-a",
      competitionName: "Serie A",
      startTimestamp: ctx.startTimestamp,
      homeTeam: ctx.homeTeam,
      awayTeam: ctx.awayTeam
    },
    simulationsCount: 200,
    skipFootApiLineupFetch: true
  });

  const simOk = Boolean(sim.ok && sim.result);
  const homeGoals = sim.result?.homeTeam?.goals?.mean;
  const awayGoals = sim.result?.awayTeam?.goals?.mean;
  const topScore = sim.result?.mostLikelyScores?.[0];
  summary(
    "match_simulation",
    simOk,
    simOk
      ? `λ gol ${Number(homeGoals ?? 0).toFixed(2)}-${Number(awayGoals ?? 0).toFixed(2)} | score più probabile ${topScore?.homeGoals ?? "?"}-${topScore?.awayGoals ?? "?"} (${((topScore?.probability ?? 0) * 100).toFixed(1)}%) | reliability=${sim.result!.reliabilityLabel} sample home/away ok`
      : (sim.message ?? "simulate_failed")
  );

  const allOk =
    realPlayers.length > 0 &&
    homePlayers.length > 0 &&
    awayPlayers.length > 0 &&
    homeBpOk &&
    awayBpOk &&
    simOk;

  console.log(`\n=== Risultato: ${allOk ? "DATI OK" : "DATI INCOMPLETI / FAIL"} ===\n`);
  process.exit(allOk ? 0 : 3);
}

main().catch((error) => {
  console.error("probe_crashed", error instanceof Error ? error.message : error);
  process.exit(1);
});
