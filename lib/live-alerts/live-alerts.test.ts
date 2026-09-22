/**
 * Live Alerts — test unitari
 * Esegui con: npx tsx lib/live-alerts/live-alerts.test.ts
 */

import {
  cadenceForMatch,
  currentValueForAlert,
  shouldCompleteAlert,
  shouldFetchDetails
} from "@/lib/live-alerts/alert-engine";
import { missedNotificationBody, reachedNotificationBody } from "@/lib/live-alerts/copy";
import {
  isMonitoredLiveMatch,
  parseLiveHubMatches,
  parseMatchSnapshot,
  parsePlayerStats,
  parseTeamStats
} from "@/lib/live-alerts/footapi-service";
import { clampTarget, rangeForStatistic } from "@/lib/live-alerts/thresholds";
import type { MatchAlertRow } from "@/lib/live-alerts/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

const baseAlert: MatchAlertRow = {
  id: "a1",
  userId: "u1",
  fixtureId: 123,
  alertType: "player",
  teamId: 10,
  playerId: 456,
  statisticName: "shots",
  targetValue: 5,
  currentValue: 3,
  status: "ACTIVE",
  subjectName: "Leao",
  locale: "it",
  createdAt: new Date().toISOString()
};

check("range team shots 0-30", rangeForStatistic("shots", "team").max === 30);
check("range player shots 0-10", rangeForStatistic("shots", "player").max === 10);
check("range player sot 0-5", rangeForStatistic("shots_on_target", "player").max === 5);
check("clamp above max", clampTarget("corners", "team", 99) === 15);
check("complete when current >= target", shouldCompleteAlert(baseAlert, 5));
check("no complete below target", !shouldCompleteAlert(baseAlert, 4));
check("no second complete if already done", !shouldCompleteAlert({ ...baseAlert, status: "COMPLETED" }, 6));

const playerValue = currentValueForAlert(baseAlert, {
  match: null,
  teams: [],
  players: [
    {
      fixtureId: 123,
      playerId: 456,
      goals: 0,
      assists: 0,
      shots: 5,
      shotsOnTarget: 2,
      fouls: 1,
      foulsReceived: 0,
      rating: 7.2,
      saves: 0,
      cards: 0
    }
  ]
});
check("player shots current value", playerValue === 5);

const teamGoal = currentValueForAlert(
  { ...baseAlert, alertType: "team", statisticName: "goal_scored", playerId: null, teamId: 10 },
  {
    match: {
      fixtureId: 123,
      homeScore: 2,
      awayScore: 1,
      status: "inprogress",
      minute: 67,
      homeTeamId: 10,
      awayTeamId: 20,
      homeTeamName: "Milan",
      awayTeamName: "Inter",
      finished: false
    },
    teams: [],
    players: []
  }
);
check("team goal scored from scoreline", teamGoal === 2);

check("fetch due when never fetched", shouldFetchDetails(null, 15_000));
check("fetch skipped inside interval", !shouldFetchDetails(new Date().toISOString(), 15_000));

const hot = cadenceForMatch({ minute: 80, priority: 1, scoredRecently: false });
check("late match faster details", hot.detailsMs === 10_000);
const cold = cadenceForMatch({ minute: 20, priority: 1, scoredRecently: false });
check("early match slower player poll", cold.playerMs === 60_000);

const snapshot = parseMatchSnapshot(9, {
  event: {
    id: 9,
    homeTeam: { id: 1, name: "A" },
    awayTeam: { id: 2, name: "B" },
    homeScore: { current: 1 },
    awayScore: { current: 0 },
    status: { type: "inprogress", description: "54'" }
  }
});
check("parse match snapshot", snapshot?.homeScore === 1 && snapshot?.minute === 54);

const teams = parseTeamStats(9, 1, 2, {
  statistics: [
    {
      period: "ALL",
      groups: [
        {
          statisticsItems: [
            { key: "totalShots", homeValue: 11, awayValue: 4 },
            { key: "shotsOnTarget", homeValue: 5, awayValue: 1 }
          ]
        }
      ]
    }
  ]
});
check("parse team shots", teams[0]?.shots === 11 && teams[1]?.shotsOnTarget === 1);

const players = parsePlayerStats(9, {
  home: { players: [{ player: { id: 7, name: "Leao" }, statistics: { totalShots: 5, goalAssist: 1 } }] }
}, new Set([7]));
check("parse only requested player", players.length === 1 && players[0]?.shots === 5);

check(
  "reached copy",
  reachedNotificationBody(baseAlert) === "🔔 Alert raggiunto: Leao ha effettuato 5 tiri"
);
check("missed copy exact", missedNotificationBody() === "🔔 Alert non raggiunto");

check(
  "serie a is monitored",
  isMonitoredLiveMatch({ competitionSlug: "italy-serie-a", competitionName: "Serie A" })
);
check(
  "champions is monitored",
  isMonitoredLiveMatch({ competitionSlug: "uefa-champions-league", competitionName: "Champions League" })
);
check(
  "nations league is monitored",
  isMonitoredLiveMatch({ competitionSlug: "uefa-nations-league", competitionName: "UEFA Nations League" })
);
check(
  "world cup by name is monitored",
  isMonitoredLiveMatch({ competitionSlug: "world-championship", competitionName: "FIFA World Cup" })
);
check(
  "serie b is excluded",
  !isMonitoredLiveMatch({ competitionSlug: "italy-serie-b", competitionName: "Serie B" })
);
check(
  "conference league excluded like menu",
  !isMonitoredLiveMatch({
    competitionSlug: "uefa-europa-conference-league",
    competitionName: "Conference League"
  })
);

const liveList = parseLiveHubMatches({
  events: [
    {
      id: 1,
      homeTeam: { id: 10, name: "Milan" },
      awayTeam: { id: 20, name: "Inter" },
      homeScore: { current: 0 },
      awayScore: { current: 0 },
      status: { type: "inprogress", description: "12'" },
      tournament: { uniqueTournament: { slug: "italy-serie-a", name: "Serie A" } }
    },
    {
      id: 2,
      homeTeam: { id: 30, name: "Parma" },
      awayTeam: { id: 40, name: "Palermo" },
      homeScore: { current: 1 },
      awayScore: { current: 1 },
      status: { type: "inprogress", description: "33'" },
      tournament: { uniqueTournament: { slug: "italy-serie-b", name: "Serie B" } }
    }
  ]
});
check("live hub keeps only monitored competitions", liveList.length === 1 && liveList[0]?.eventId === 1);

const failed = results.filter((row) => !row.passed);
for (const row of results) {
  console.log(`${row.passed ? "ok" : "FAIL"}  ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
}
if (failed.length) {
  console.error(`\n${failed.length} test falliti`);
  process.exit(1);
}
console.log(`\n${results.length} test ok`);
