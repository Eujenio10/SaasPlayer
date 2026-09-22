import {
  cadenceForMatch,
  currentValueForAlert,
  shouldCompleteAlert,
  shouldFetchDetails
} from "@/lib/live-alerts/alert-engine";
import {
  fetchMatchDetails,
  fetchMatchIncidents,
  fetchMatchStatistics,
  fetchPlayerMatchStatistics,
  isMonitoredLiveMatch
} from "@/lib/live-alerts/footapi-service";
import { sendLiveAlertNotifications } from "@/lib/live-alerts/notification-service";
import {
  deleteFixtureLiveData,
  listActiveAlerts,
  listActiveMatches,
  markMatchFetched,
  pruneStaleViewers,
  readMatchCache,
  readPlayerStats,
  readTeamStats,
  recountAndSyncActiveMatch,
  updateAlertProgress,
  upsertMatchCache,
  upsertPlayerStats,
  upsertTeamStats
} from "@/lib/live-alerts/persist";
import { needsIncidents, needsPlayerStats, needsTeamStats } from "@/lib/live-alerts/thresholds";
import type { LiveTickResult, MatchAlertRow } from "@/lib/live-alerts/types";

const recentGoals = new Map<number, number>();

export async function runLiveAlertsTick(): Promise<LiveTickResult> {
  const result: LiveTickResult = {
    ok: true,
    monitored: 0,
    apiCalls: 0,
    alertsCompleted: 0,
    alertsFailed: 0,
    notificationsSent: 0,
    cleaned: 0,
    errors: []
  };

  try {
    await pruneStaleViewers();
    const matches = await listActiveMatches();
    result.monitored = matches.length;
    console.log("[live-alerts] tick_start", { monitored: matches.length });

    for (const match of matches) {
      try {
        await recountAndSyncActiveMatch(match.fixtureId);
        const alerts = await listActiveAlerts(match.fixtureId);
        const cache = await readMatchCache(match.fixtureId);
        const scoredRecently = Date.now() - (recentGoals.get(match.fixtureId) ?? 0) < 120_000;
        const cadence = cadenceForMatch({
          minute: cache?.minute ?? null,
          priority: match.priority,
          scoredRecently
        });

        const wantTeam = alerts.some((alert) => needsTeamStats(alert.statisticName));
        const wantPlayer = alerts.some((alert) => needsPlayerStats(alert.statisticName));
        const wantIncidents = alerts.some((alert) => needsIncidents(alert.statisticName));
        const watchOnly = alerts.length === 0;

        let snapshot = cache;
        if (shouldFetchDetails(match.lastDetailsAt, cadence.detailsMs)) {
          const details = await fetchMatchDetails(match.fixtureId);
          result.apiCalls += 1;
          if (details) {
            if (!isMonitoredLiveMatch(details)) {
              console.log("[live-alerts] skip_unmonitored_competition", {
                fixtureId: match.fixtureId,
                competitionSlug: details.competitionSlug
              });
              await deleteFixtureLiveData(match.fixtureId);
              result.cleaned += 1;
              continue;
            }
            if (cache && details.homeScore + details.awayScore > cache.homeScore + cache.awayScore) {
              recentGoals.set(match.fixtureId, Date.now());
            }
            snapshot = details;
            await upsertMatchCache(details);
            await markMatchFetched(match.fixtureId, "details");
          }
        }

        if (!snapshot) continue;

        if (snapshot.finished) {
          if (alerts.length) {
            result.notificationsSent += await sendLiveAlertNotifications(alerts, "missed");
            for (const alert of alerts) {
              await updateAlertProgress(alert.id, alert.currentValue, "FAILED");
              result.alertsFailed += 1;
            }
          }
          await deleteFixtureLiveData(match.fixtureId);
          result.cleaned += 1;
          continue;
        }

        if (watchOnly) continue;

        let teams = await readTeamStats(match.fixtureId);
        if (
          wantTeam &&
          snapshot.homeTeamId &&
          snapshot.awayTeamId &&
          shouldFetchDetails(match.lastTeamStatsAt, cadence.teamMs)
        ) {
          teams = await fetchMatchStatistics(match.fixtureId, snapshot.homeTeamId, snapshot.awayTeamId);
          result.apiCalls += 1;
          if (teams.length) {
            await upsertTeamStats(teams);
            await markMatchFetched(match.fixtureId, "team");
          }
        }

        const playerIds = new Set(
          alerts.filter((alert) => alert.playerId).map((alert) => alert.playerId as number)
        );
        let players = await readPlayerStats(match.fixtureId);
        if (wantPlayer && playerIds.size && shouldFetchDetails(match.lastPlayerStatsAt, cadence.playerMs)) {
          players = await fetchPlayerMatchStatistics(match.fixtureId, playerIds);
          result.apiCalls += 1;
          if (players.length) {
            await upsertPlayerStats(players);
            await markMatchFetched(match.fixtureId, "player");
          }
        }

        if (wantIncidents && snapshot.homeTeamId && snapshot.awayTeamId) {
          const incidents = await fetchMatchIncidents(match.fixtureId);
          result.apiCalls += 1;
          if (incidents) {
            teams = teams.map((row) => {
              const isHome = row.teamId === snapshot?.homeTeamId;
              return {
                ...row,
                redCards: isHome ? incidents.homeRed : incidents.awayRed,
                penalties: isHome ? incidents.homePen : incidents.awayPen
              };
            });
            if (teams.length) await upsertTeamStats(teams);
            players = players.map((row) => ({
              ...row,
              cards: incidents.playerCards.get(row.playerId) ?? row.cards
            }));
            if (players.length) await upsertPlayerStats(players);
          }
        }

        const reached: MatchAlertRow[] = [];
        for (const alert of alerts) {
          const current = currentValueForAlert(alert, { match: snapshot, teams, players });
          if (current == null) continue;
          if (shouldCompleteAlert(alert, current)) {
            await updateAlertProgress(alert.id, current, "COMPLETED");
            reached.push({ ...alert, currentValue: current, status: "COMPLETED" });
            result.alertsCompleted += 1;
          } else if (current !== alert.currentValue) {
            await updateAlertProgress(alert.id, current, "ACTIVE");
          }
        }
        if (reached.length) {
          result.notificationsSent += await sendLiveAlertNotifications(reached, "reached");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "match_tick_failed";
        console.error("[live-alerts] match_error", { fixtureId: match.fixtureId, message });
        result.errors.push(`${match.fixtureId}: ${message}`);
      }
    }
  } catch (error) {
    result.ok = false;
    const message = error instanceof Error ? error.message : "tick_failed";
    console.error("[live-alerts] tick_failed", message);
    result.errors.push(message);
  }

  console.log("[live-alerts] tick_done", result);
  return result;
}
