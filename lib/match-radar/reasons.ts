import type { MatchRadarDimensions, MatchRadarReason, TeamRadarSnapshotRow } from "@/lib/match-radar/types";

import type { MatchRadarRefereeProfile } from "@/lib/match-radar/referee";

import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";



function pushReason(list: MatchRadarReason[], reason: MatchRadarReason): void {

  list.push(reason);

}



function pct(value: number | null | undefined): string {

  if (value == null) return "—";

  return String(Math.round(value));

}



function avg1(value: number | null | undefined): string {

  if (value == null || !Number.isFinite(value)) return "—";

  return (Math.round(value * 10) / 10).toFixed(1);

}



export function generateMatchRadarReasons(params: {

  dimensions: MatchRadarDimensions;

  home: TeamRadarSnapshotRow | null;

  away: TeamRadarSnapshotRow | null;

  homeTeamName: string;

  awayTeamName: string;

  referee?: MatchRadarRefereeProfile | null;

}): MatchRadarReason[] {

  const { dimensions, home, away, homeTeamName, awayTeamName, referee } = params;

  const reasons: MatchRadarReason[] = [];



  if (

    referee?.strictnessScore != null &&

    referee.strictnessScore >= MATCH_RADAR_CONFIG.refereeBoostThreshold

  ) {

    pushReason(reasons, {

      key: "strict_referee_profile",

      category: "referee",

      score: referee.strictnessScore,

      parameters: {

        yellowPerMatch: referee.yellowCardsPerMatch ?? 0,

        foulsPerMatch: referee.foulsPerMatch ?? 0,

        redPerMatch: referee.redCardsPerMatch ?? 0,

        foulsVsCompetitionPct: referee.foulsVsCompetitionPct ?? 0,

        yellowVsCompetitionPct: referee.yellowCardsVsCompetitionPct ?? 0,

        sample: referee.matchesSample

      }

    });

  }



  const homeFouls = home?.rawAggregates.avgFoulsFor;

  const awayFouls = away?.rawAggregates.avgFoulsFor;

  if (

    home?.foulsForScore != null &&

    home.foulsForScore >= 65 &&

    away?.foulsForScore != null &&

    away.foulsForScore >= 65

  ) {

    pushReason(reasons, {

      key: "both_teams_high_foul_average",

      category: "intensity",

      score: Math.round((home.foulsForScore + away.foulsForScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeFoulsAvg: avg1(homeFouls),

        awayFoulsAvg: avg1(awayFouls),

        homeFoulsPct: pct(home.foulsForScore),

        awayFoulsPct: pct(away.foulsForScore)

      }

    });

  }



  if (

    home?.foulsForScore != null &&

    home.foulsForScore >= 75 &&

    away?.foulsAgainstScore != null &&

    away.foulsAgainstScore >= 75

  ) {

    pushReason(reasons, {

      key: "high_foul_interaction",

      category: "intensity",

      score: Math.round((home.foulsForScore + away.foulsAgainstScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeFoulsPct: pct(home.foulsForScore),

        awayDrawnPct: pct(away.foulsAgainstScore)

      }

    });

  }



  if (

    away?.foulsForScore != null &&

    away.foulsForScore >= 75 &&

    home?.foulsAgainstScore != null &&

    home.foulsAgainstScore >= 75

  ) {

    pushReason(reasons, {

      key: "high_foul_interaction_away",

      category: "intensity",

      score: Math.round((away.foulsForScore + home.foulsAgainstScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        awayFoulsPct: pct(away.foulsForScore),

        homeDrawnPct: pct(home.foulsAgainstScore)

      }

    });

  }



  const homeCards = home?.rawAggregates.avgCards;

  const awayCards = away?.rawAggregates.avgCards;

  if (

    (home?.cardsScore ?? 0) >= 70 &&

    (away?.cardsScore ?? 0) >= 70 &&

    home?.cardsScore != null &&

    away?.cardsScore != null

  ) {

    pushReason(reasons, {

      key: "elevated_card_frequency",

      category: "intensity",

      score: Math.round((home.cardsScore + away.cardsScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeCardsAvg: avg1(homeCards),

        awayCardsAvg: avg1(awayCards),

        cardsPct: pct((home.cardsScore + away.cardsScore) / 2)

      }

    });

  }



  if (

    home?.foulsForScore != null &&

    home.foulsForScore >= 68 &&

    away?.foulsForScore != null &&

    away.foulsForScore >= 68 &&

    home?.cardsScore != null &&

    home.cardsScore >= 65 &&

    away?.cardsScore != null &&

    away.cardsScore >= 65

  ) {

    pushReason(reasons, {

      key: "physical_disciplinary_clash",

      category: "intensity",

      score: Math.round(

        (home.foulsForScore + away.foulsForScore + home.cardsScore + away.cardsScore) / 4

      ),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeFoulsAvg: avg1(homeFouls),

        awayFoulsAvg: avg1(awayFouls),

        homeCardsAvg: avg1(homeCards),

        awayCardsAvg: avg1(awayCards)

      }

    });

  }



  const homeOffsides = home?.rawAggregates.avgOffsidesFor;

  const awayOffsides = away?.rawAggregates.avgOffsidesFor;

  if (

    home?.offsidesForScore != null &&

    home.offsidesForScore >= 68 &&

    away?.offsidesForScore != null &&

    away.offsidesForScore >= 68

  ) {

    pushReason(reasons, {

      key: "elevated_offside_activity",

      category: "attacking",

      score: Math.round((home.offsidesForScore + away.offsidesForScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeOffsidesAvg: avg1(homeOffsides),

        awayOffsidesAvg: avg1(awayOffsides),

        offsidesPct: pct((home.offsidesForScore + away.offsidesForScore) / 2)

      }

    });

  }



  const homeOutside = home?.rawAggregates.avgShotsOutsideBoxFor;

  const awayOutside = away?.rawAggregates.avgShotsOutsideBoxFor;

  if (

    home?.shotsOutsideBoxForScore != null &&

    home.shotsOutsideBoxForScore >= 68 &&

    away?.shotsOutsideBoxForScore != null &&

    away.shotsOutsideBoxForScore >= 68

  ) {

    pushReason(reasons, {

      key: "long_range_shooting_volume",

      category: "attacking",

      score: Math.round((home.shotsOutsideBoxForScore + away.shotsOutsideBoxForScore) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeOutsideAvg: avg1(homeOutside),

        awayOutsideAvg: avg1(awayOutside),

        outsidePct: pct((home.shotsOutsideBoxForScore + away.shotsOutsideBoxForScore) / 2)

      }

    });

  } else if (

    home?.shotsOutsideBoxForScore != null &&

    home.shotsOutsideBoxForScore >= 75 &&

    away?.shotsOutsideBoxForScore != null &&

    away.shotsOutsideBoxForScore >= 55

  ) {

    pushReason(reasons, {

      key: "home_long_range_threat",

      category: "attacking",

      score: home.shotsOutsideBoxForScore,

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeOutsideAvg: avg1(homeOutside),

        awayOutsideAvg: avg1(awayOutside)

      }

    });

  } else if (

    away?.shotsOutsideBoxForScore != null &&

    away.shotsOutsideBoxForScore >= 75 &&

    home?.shotsOutsideBoxForScore != null &&

    home.shotsOutsideBoxForScore >= 55

  ) {

    pushReason(reasons, {

      key: "away_long_range_threat",

      category: "attacking",

      score: away.shotsOutsideBoxForScore,

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        homeOutsideAvg: avg1(homeOutside),

        awayOutsideAvg: avg1(awayOutside)

      }

    });

  }



  const combinedShots =

    home?.shotsForScore != null && away?.shotsForScore != null

      ? (home.shotsForScore + away.shotsForScore) / 2

      : null;

  const combinedSot =

    home?.shotsOnTargetForScore != null && away?.shotsOnTargetForScore != null

      ? (home.shotsOnTargetForScore + away.shotsOnTargetForScore) / 2

      : null;



  if (combinedShots != null && combinedShots >= 80 && combinedSot != null && combinedSot >= 70) {

    pushReason(reasons, {

      key: "high_attacking_volume",

      category: "attacking",

      score: Math.round((combinedShots + combinedSot) / 2),

      parameters: {

        homeTeam: homeTeamName,

        awayTeam: awayTeamName,

        shotsPct: pct(combinedShots)

      }

    });

  }



  if (dimensions.attackingPotential != null && dimensions.attackingPotential >= 78) {

    pushReason(reasons, {

      key: "above_average_offensive_profile",

      category: "attacking",

      score: dimensions.attackingPotential,

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  if (dimensions.balance != null && dimensions.balance >= 80) {

    pushReason(reasons, {

      key: "teams_statistically_close",

      category: "balance",

      score: dimensions.balance,

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  if (dimensions.volatility != null && dimensions.volatility >= 80) {

    pushReason(reasons, {

      key: "high_recent_variability",

      category: "volatility",

      score: dimensions.volatility,

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  if (

    home?.cornersForScore != null &&

    home.cornersForScore >= 72 &&

    away?.cornersAgainstScore != null &&

    away.cornersAgainstScore >= 72

  ) {

    pushReason(reasons, {

      key: "corner_pressure_mismatch",

      category: "mismatch",

      score: Math.round((home.cornersForScore + away.cornersAgainstScore) / 2),

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  if (dimensions.tacticalMismatch != null && dimensions.tacticalMismatch >= 75) {

    pushReason(reasons, {

      key: "statistical_style_contrast",

      category: "mismatch",

      score: dimensions.tacticalMismatch,

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  if (dimensions.intensity != null && dimensions.intensity >= 78 && reasons.length === 0) {

    pushReason(reasons, {

      key: "elevated_match_intensity",

      category: "intensity",

      score: dimensions.intensity,

      parameters: { homeTeam: homeTeamName, awayTeam: awayTeamName }

    });

  }



  return reasons

    .sort((a, b) => b.score - a.score)

    .slice(0, MATCH_RADAR_CONFIG.maxReasons);

}


