/**
 * Player Performance — test unitari
 * Esegui con: npx tsx lib/player-performance/player-performance.test.ts
 */

import {
  isPlayerPerformanceAnchorStillUpcoming,
  PlayerPerformanceMatchStartedError,
  assertPlayerPerformancePreMatch
} from "@/lib/player-performance/fixture-eligibility";
import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { calculatePer90, clamp } from "@/lib/player-performance/per90";
import { percentageChange, calculateOffensiveTrend } from "@/lib/player-performance/offensive-trend";
import { normalizeMinMax, normalizePercentile, reweightAvailableMetrics } from "@/lib/player-performance/normalize";
import { calculateDangerIndex } from "@/lib/player-performance/danger-index";
import { classifyTrendStatus } from "@/lib/player-performance/classify";
import {
  aggregatePlayerAppearances,
  passesDangerSample,
  passesTrendSample,
  splitTeamMatchWindows,
  toPerformanceMetrics
} from "@/lib/player-performance/aggregate";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function appearance(
  partial: Partial<PlayerMatchTrendStats> & Pick<PlayerMatchTrendStats, "matchId" | "matchDate" | "playerId">
): PlayerMatchTrendStats {
  return {
    competitionId: "serie-a",
    seasonId: "123",
    teamId: "1",
    opponentId: "2",
    homeAway: "home",
    starter: true,
    minutesPlayed: 80,
    shots: 2,
    shotsOnTarget: 1,
    saves: null,
    dataComplete: true,
    importedAt: new Date().toISOString(),
    normalizedRole: "CENTER_FORWARD",
    ...partial
  };
}

check("per90 from minutes", calculatePer90(4, 180) === 2);
check("per90 zero minutes", calculatePer90(0, 0) === 0);

const aggregated = aggregatePlayerAppearances([
  appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "10", minutesPlayed: 45, shots: 2, shotsOnTarget: 1 }),
  appearance({ matchId: "2", matchDate: "2026-01-08", playerId: "10", minutesPlayed: 45, shots: 4, shotsOnTarget: 2 })
]);
check("aggregates total minutes", aggregated.minutes === 90);
check("per90 uses minutes not appearances", toPerformanceMetrics(aggregated).shotsPer90 === 6);

const windows = splitTeamMatchWindows([
  "m10",
  "m9",
  "m8",
  "m7",
  "m6",
  "m5",
  "m4",
  "m3",
  "m2",
  "m1"
]);
check(
  "recent team window has 5 matches",
  windows.recentMatchIds.length === 5 && windows.recentMatchIds[0] === "m10"
);
check("baseline team window has 5 matches", windows.baselineMatchIds.length === 5);

check(
  "zero baseline uses capped new production",
  percentageChange(1.5, 0) === Math.min(PLAYER_PERFORMANCE_CONFIG.newProductionCapPercent, 1.5 * 40)
);
check("positive percentage change", percentageChange(3, 2) === 50);
check("negative percentage capped", percentageChange(0, 5) === -100);
check(
  "percentage change capped high",
  percentageChange(10, 1) === PLAYER_PERFORMANCE_CONFIG.trendChangeCapMax
);

const trend = calculateOffensiveTrend({
  recentShotsPer90: 3,
  baselineShotsPer90: 2,
  recentShotsOnTargetPer90: 1.2,
  baselineShotsOnTargetPer90: 1,
  recentKeyPassesPer90: null,
  baselineKeyPassesPer90: null
});
check("offensive trend positive", (trend ?? 0) > 0);

check("min-max middle value", normalizeMinMax(5, 5, 5) === 50);
check("min-max max value", normalizeMinMax(10, 0, 10) === 100);
check("percentile ranks highest", normalizePercentile(5, [1, 2, 3, 4, 5]) > 50);

const weights = reweightAvailableMetrics(PLAYER_PERFORMANCE_CONFIG.dangerWeights, [
  "shots",
  "shotsOnTarget"
]);
check("reweighted danger metrics sum to 1", Math.abs(weights.shots + weights.shotsOnTarget - 1) < 0.001);

const danger = calculateDangerIndex(
  {
    shotsPer90: 4,
    shotsOnTargetPer90: 2,
    keyPassesPer90: 1,
    successfulDribblesPer90: 1
  },
  {
    playerId: "p4",
    roleGroup: "forward",
    cohort: [
      {
        playerId: "p1",
        roleGroup: "forward",
        shotsPer90: 1,
        shotsOnTargetPer90: 0.5,
        keyPassesPer90: 0.2,
        successfulDribblesPer90: 0.1
      },
      {
        playerId: "p2",
        roleGroup: "forward",
        shotsPer90: 2,
        shotsOnTargetPer90: 1,
        keyPassesPer90: 0.5,
        successfulDribblesPer90: 0.2
      },
      {
        playerId: "p3",
        roleGroup: "forward",
        shotsPer90: 3,
        shotsOnTargetPer90: 1.2,
        keyPassesPer90: 0.8,
        successfulDribblesPer90: 0.4
      },
      {
        playerId: "p4",
        roleGroup: "forward",
        shotsPer90: 4,
        shotsOnTargetPer90: 2,
        keyPassesPer90: 1,
        successfulDribblesPer90: 1
      }
    ]
  }
);
check("danger index within bounds", danger >= 0 && danger <= 100);

check(
  "short sample player excluded from trend",
  !passesTrendSample({
    recentAppearances: 5,
    recentMinutes: 50,
    baselineAppearances: 5,
    baselineMinutes: 50
  })
);
check(
  "two long appearances still below recent threshold",
  !passesTrendSample({
    recentAppearances: 2,
    recentMinutes: 180,
    baselineAppearances: 3,
    baselineMinutes: 270
  })
);
check("missing key passes still allows trend", calculateOffensiveTrend({
  recentShotsPer90: 2,
  baselineShotsPer90: 1,
  recentShotsOnTargetPer90: 1,
  baselineShotsOnTargetPer90: 0.5,
  recentKeyPassesPer90: null,
  baselineKeyPassesPer90: null
}) != null);
check("null incomplete metrics aggregate safely", aggregatePlayerAppearances([
  appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "10", keyPasses: undefined as never })
]).hasKeyPasses === false);

check("classify strong growth", classifyTrendStatus(35) === "strong_growth");
check("classify growth", classifyTrendStatus(20) === "growth");
check("classify stable", classifyTrendStatus(0) === "stable");
check("classify decline", classifyTrendStatus(-20) === "decline");
check("classify strong decline", classifyTrendStatus(-40) === "strong_decline");

check(
  "trend sample passes thresholds",
  passesTrendSample({
    recentAppearances: 3,
    recentMinutes: 180,
    baselineAppearances: 3,
    baselineMinutes: 270
  })
);
check(
  "trend sample rejects low minutes",
  !passesTrendSample({
    recentAppearances: 2,
    recentMinutes: 120,
    baselineAppearances: 3,
    baselineMinutes: 270
  })
);
check("danger sample threshold", passesDangerSample(270) && !passesDangerSample(269));
check("clamp helper", clamp(120, -100, 100) === 100);

const futureKickoff = Math.floor(Date.now() / 1000) + 3600;
const pastKickoff = Math.floor(Date.now() / 1000) - 3600;
check(
  "pre-match fixture still upcoming",
  isPlayerPerformanceAnchorStillUpcoming({ fixtureId: 100, kickoffTimestamp: futureKickoff })
);
check(
  "started fixture excluded",
  !isPlayerPerformanceAnchorStillUpcoming({ fixtureId: 100, kickoffTimestamp: pastKickoff })
);
try {
  assertPlayerPerformancePreMatch({ fixtureId: 100, kickoffTimestamp: pastKickoff });
  check("assert throws for started match", false);
} catch (error) {
  check(
    "assert throws for started match",
    error instanceof PlayerPerformanceMatchStartedError
  );
}

const failed = results.filter((result) => !result.passed);
for (const result of results) {
  console.log(result.passed ? "✓" : "✗", result.name, result.detail ?? "");
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
