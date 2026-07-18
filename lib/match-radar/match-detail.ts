import type {
  MatchRadarComputed,
  MatchRadarDetailResponse,
  MatchRadarListHighlights,
  MatchRadarMatchupRow,
  MatchRadarTeamDetail,
  TeamRadarSnapshotRow
} from "@/lib/match-radar/types";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";
import { estimateShotsOutsideBoxForDisplay } from "@/lib/match-radar/feature-extraction";

function round1(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

/** Evita di mostrare percentili o valori corrotti come «cartellini/partita». */
function sanitizePerMatchRate(value: number | null | undefined, max = 10): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return round1(value);
}

function formatStat(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${round1(value)}${suffix}`;
}

export function summarizeTeamSnapshot(params: {
  snapshot: TeamRadarSnapshotRow | null;
  venueSnapshot: TeamRadarSnapshotRow | null;
  teamId: string;
  teamName: string;
  venue: "home" | "away";
}): MatchRadarTeamDetail | null {
  const { snapshot, venueSnapshot, teamId, teamName, venue } = params;
  if (!snapshot) return null;

  const raw = snapshot.rawAggregates;
  const venueRaw = venueSnapshot?.rawAggregates ?? null;

  return {
    teamId,
    teamName,
    venue,
    matchesSample: raw.matchesLast10 || snapshot.matchesLast10,
    formScore: snapshot.formScore,
    teamStrengthScore: snapshot.teamStrengthScore,
    volatilityScore: snapshot.volatilityScore,
    stats: {
      avgGoalsFor: round1(raw.avgGoalsFor),
      avgGoalsAgainst: round1(raw.avgGoalsAgainst),
      avgShotsFor: round1(raw.avgShotsFor),
      avgShotsOnTargetFor: round1(raw.avgShotsOnTargetFor),
      avgFoulsCommitted: round1(raw.avgFoulsFor),
      avgFoulsSuffered: round1(raw.avgFoulsAgainst),
      avgCards: sanitizePerMatchRate(raw.avgCards),
      avgCornersFor: round1(raw.avgCornersFor),
      avgOffsidesFor: round1(raw.avgOffsidesFor),
      avgShotsOutsideBoxFor: round1(
        estimateShotsOutsideBoxForDisplay(
          raw.avgShotsFor,
          raw.avgShotsOnTargetFor,
          raw.avgShotsOutsideBoxFor
        )
      ),
      avgPossession: raw.avgPossession != null ? Math.round(raw.avgPossession) : null,
      pointsPerMatch: round1(raw.pointsPerMatch),
      goalDiffPerMatch: round1(raw.goalDiff),
      avgXgFor: round1(raw.avgXgFor)
    },
    venueSplit: venueRaw
      ? {
          matchesSample: venueRaw.matchesLast10 || venueSnapshot!.matchesLast10,
          avgGoalsFor: round1(venueRaw.avgGoalsFor),
          avgGoalsAgainst: round1(venueRaw.avgGoalsAgainst),
          pointsPerMatch: round1(venueRaw.pointsPerMatch)
        }
      : null
  };
}

export function buildTeamContextFromSnapshots(params: {
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeAll: TeamRadarSnapshotRow | null;
  homeVenue: TeamRadarSnapshotRow | null;
  awayAll: TeamRadarSnapshotRow | null;
  awayVenue: TeamRadarSnapshotRow | null;
}): { home: MatchRadarTeamDetail | null; away: MatchRadarTeamDetail | null } {
  return {
    home: summarizeTeamSnapshot({
      snapshot: params.homeAll,
      venueSnapshot: params.homeVenue,
      teamId: params.homeTeamId,
      teamName: params.homeTeamName,
      venue: "home"
    }),
    away: summarizeTeamSnapshot({
      snapshot: params.awayAll,
      venueSnapshot: params.awayVenue,
      teamId: params.awayTeamId,
      teamName: params.awayTeamName,
      venue: "away"
    })
  };
}

function insightLine(
  locale: "it" | "en",
  homeVal: number | null,
  awayVal: number | null,
  metric: "goals" | "fouls" | "corners"
): string | undefined {
  if (homeVal == null || awayVal == null) return undefined;
  const diff = homeVal - awayVal;
  if (Math.abs(diff) < 0.4) return undefined;

  if (locale === "it") {
    if (metric === "goals") {
      return diff > 0
        ? "La squadra di casa segna di più di quanto ne subisca la trasferta in media."
        : "La trasferta subisce meno gol di quanti ne segni la casa in media.";
    }
    if (metric === "fouls") {
      return diff > 0
        ? "Profilo fisico: la casa commette molti falli contro una trasferta che ne subisce spesso."
        : "La trasferta è più aggressiva in falli rispetto a quanto ne subisce la casa.";
    }
    return diff > 0
      ? "Possibile pressione sulle fasce: molti corner creati in casa vs trasferta che ne concede."
      : "La trasferta genera corner più della capacità difensiva laterale della casa.";
  }

  if (metric === "goals") {
    return diff > 0
      ? "Home scores more than the away side typically concedes."
      : "Away concedes fewer goals than home typically scores.";
  }
  if (metric === "fouls") {
    return diff > 0
      ? "Physical profile: home commits many fouls vs an away side that often draws contact."
      : "Away is more aggressive in fouls than home typically suffers.";
  }
  return diff > 0
    ? "Wing pressure likely: home creates corners vs an away side that concedes them."
    : "Away generates more corners than home typically allows.";
}

export function buildMatchupInsights(
  home: MatchRadarTeamDetail | null,
  away: MatchRadarTeamDetail | null,
  locale: "it" | "en"
): MatchRadarMatchupRow[] {
  if (!home || !away) return [];
  const ui = MATCH_RADAR_UI_TEXT[locale];

  const rows: MatchRadarMatchupRow[] = [
    {
      id: "goals_for",
      label: locale === "it" ? "Gol fatti (media torneo)" : "Goals scored (tournament avg)",
      homeDisplay: formatStat(home.stats.avgGoalsFor),
      awayDisplay: formatStat(away.stats.avgGoalsFor),
      homeCaption: ui.statGoalsFor,
      awayCaption: ui.statGoalsFor
    },
    {
      id: "goals_against",
      label: locale === "it" ? "Gol subiti (media torneo)" : "Goals conceded (tournament avg)",
      homeDisplay: formatStat(home.stats.avgGoalsAgainst),
      awayDisplay: formatStat(away.stats.avgGoalsAgainst),
      homeCaption: ui.statGoalsAgainst,
      awayCaption: ui.statGoalsAgainst
    },
    {
      id: "attack_vs_defense",
      label: locale === "it" ? "Attacco casa vs difesa trasferta" : "Home attack vs away defense",
      homeDisplay: formatStat(home.stats.avgGoalsFor),
      awayDisplay: formatStat(away.stats.avgGoalsAgainst),
      homeCaption: ui.statGoalsFor,
      awayCaption: ui.statGoalsAgainst,
      insight: insightLine(locale, home.stats.avgGoalsFor, away.stats.avgGoalsAgainst, "goals")
    },
    {
      id: "defense_vs_attack",
      label: locale === "it" ? "Difesa casa vs attacco trasferta" : "Home defense vs away attack",
      homeDisplay: formatStat(home.stats.avgGoalsAgainst),
      awayDisplay: formatStat(away.stats.avgGoalsFor),
      homeCaption: ui.statGoalsAgainst,
      awayCaption: ui.statGoalsFor,
      insight: insightLine(locale, away.stats.avgGoalsFor, home.stats.avgGoalsAgainst, "goals")
    },
    {
      id: "shots",
      label: locale === "it" ? "Volume tiri" : "Shot volume",
      homeDisplay: formatStat(home.stats.avgShotsFor),
      awayDisplay: formatStat(away.stats.avgShotsFor),
      homeCaption: ui.statShotsFor,
      awayCaption: ui.statShotsFor
    },
    {
      id: "fouls",
      label: locale === "it" ? "Falli commessi" : "Fouls committed",
      homeDisplay: formatStat(home.stats.avgFoulsCommitted),
      awayDisplay: formatStat(away.stats.avgFoulsCommitted),
      homeCaption: ui.statFoulsCommitted,
      awayCaption: ui.statFoulsCommitted,
      insight: insightLine(
        locale,
        home.stats.avgFoulsCommitted,
        away.stats.avgFoulsSuffered,
        "fouls"
      )
    },
    {
      id: "fouls_drawn",
      label: locale === "it" ? "Falli subiti" : "Fouls drawn",
      homeDisplay: formatStat(home.stats.avgFoulsSuffered),
      awayDisplay: formatStat(away.stats.avgFoulsSuffered),
      homeCaption: ui.statFoulsSuffered,
      awayCaption: ui.statFoulsSuffered
    },
    {
      id: "cards",
      label: locale === "it" ? "Cartellini a partita" : "Cards per match",
      homeDisplay: formatStat(home.stats.avgCards),
      awayDisplay: formatStat(away.stats.avgCards),
      homeCaption: ui.statCards,
      awayCaption: ui.statCards,
      insight:
        home.stats.avgCards != null &&
        away.stats.avgCards != null &&
        home.stats.avgCards >= 2 &&
        away.stats.avgCards >= 2
          ? locale === "it"
            ? "Entrambe le squadre stanno accumulando cartellini sopra la media: contesto disciplinare da monitorare."
            : "Both teams are picking up cards above average: a disciplinary context to watch."
          : undefined
    },
    {
      id: "offsides",
      label: locale === "it" ? "Fuorigioco a partita" : "Offsides per match",
      homeDisplay: formatStat(home.stats.avgOffsidesFor),
      awayDisplay: formatStat(away.stats.avgOffsidesFor),
      homeCaption: ui.statOffsides,
      awayCaption: ui.statOffsides,
      insight:
        home.stats.avgOffsidesFor != null &&
        away.stats.avgOffsidesFor != null &&
        home.stats.avgOffsidesFor + away.stats.avgOffsidesFor >= 5
          ? locale === "it"
            ? "Linee alte e pressing: entrambe le squadre finiscono spesso in fuorigioco."
            : "High lines and pressing: both teams are frequently caught offside."
          : undefined
    },
    {
      id: "shots_outside_box",
      label: locale === "it" ? "Tiri da fuori area" : "Shots outside the box",
      homeDisplay: formatStat(home.stats.avgShotsOutsideBoxFor),
      awayDisplay: formatStat(away.stats.avgShotsOutsideBoxFor),
      homeCaption: ui.statShotsOutsideBox,
      awayCaption: ui.statShotsOutsideBox,
      insight:
        home.stats.avgShotsOutsideBoxFor != null &&
        away.stats.avgShotsOutsideBoxFor != null &&
        home.stats.avgShotsOutsideBoxFor + away.stats.avgShotsOutsideBoxFor >= 7
          ? locale === "it"
            ? "Entrambe le squadre tirano spesso da lontano: possibile volume di conclusioni da fuori area."
            : "Both teams shoot often from distance: potential long-range finishing volume."
          : undefined
    },
    {
      id: "corners",
      label: locale === "it" ? "Corner a favore" : "Corners for",
      homeDisplay: formatStat(home.stats.avgCornersFor),
      awayDisplay: formatStat(away.stats.avgCornersFor),
      homeCaption: ui.statCornersFor,
      awayCaption: ui.statCornersFor,
      insight: insightLine(locale, home.stats.avgCornersFor, away.stats.avgCornersFor, "corners")
    },
    {
      id: "form",
      label: locale === "it" ? "Punti a partita" : "Points per match",
      homeDisplay: formatStat(home.stats.pointsPerMatch),
      awayDisplay: formatStat(away.stats.pointsPerMatch),
      homeCaption: ui.statPoints,
      awayCaption: ui.statPoints
    }
  ];

  return rows.filter((row) => row.homeDisplay !== "—" || row.awayDisplay !== "—");
}

export function buildListHighlights(
  home: MatchRadarTeamDetail | null,
  away: MatchRadarTeamDetail | null
): MatchRadarListHighlights | null {
  if (!home || !away) return null;
  const combinedGoals =
    home.stats.avgGoalsFor != null && away.stats.avgGoalsFor != null
      ? round1(home.stats.avgGoalsFor + away.stats.avgGoalsFor)
      : null;
  const combinedFouls =
    home.stats.avgFoulsCommitted != null && away.stats.avgFoulsCommitted != null
      ? round1(home.stats.avgFoulsCommitted + away.stats.avgFoulsCommitted)
      : null;
  const combinedCards =
    home.stats.avgCards != null && away.stats.avgCards != null
      ? round1(home.stats.avgCards + away.stats.avgCards)
      : null;
  const combinedOffsides =
    home.stats.avgOffsidesFor != null && away.stats.avgOffsidesFor != null
      ? round1(home.stats.avgOffsidesFor + away.stats.avgOffsidesFor)
      : null;
  return {
    homeGoalsPerMatch: home.stats.avgGoalsFor,
    awayGoalsPerMatch: away.stats.avgGoalsFor,
    combinedGoalsPerMatch: combinedGoals,
    combinedFoulsPerMatch: combinedFouls,
    combinedCardsPerMatch: combinedCards,
    combinedOffsidesPerMatch: combinedOffsides,
    homeFormScore: home.formScore,
    awayFormScore: away.formScore
  };
}

function readStoredTeamContext(metadata: Record<string, unknown>): {
  home: MatchRadarTeamDetail | null;
  away: MatchRadarTeamDetail | null;
} {
  const raw = metadata.teamContext as
    | { home?: MatchRadarTeamDetail | null; away?: MatchRadarTeamDetail | null }
    | undefined;
  return {
    home: raw?.home ?? null,
    away: raw?.away ?? null
  };
}

export function buildMatchRadarDetailResponse(params: {
  row: MatchRadarComputed;
  locale: "it" | "en";
  isPro: boolean;
  fullDetail?: boolean;
  fallbackTeams?: { home: MatchRadarTeamDetail | null; away: MatchRadarTeamDetail | null };
}): MatchRadarDetailResponse {
  const { row, locale, isPro, fullDetail = false } = params;
  const metadata = row.calculationMetadata ?? {};
  const teams = params.fallbackTeams ?? readStoredTeamContext(metadata);
  const showFull = fullDetail || isPro;

  const matchupInsights = buildMatchupInsights(teams.home, teams.away, locale);
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const matchupSampleNote =
    teams.home?.matchesSample && teams.away?.matchesSample
      ? ui.matchupSampleNote(teams.home.matchesSample, teams.away.matchesSample)
      : null;
  const refereeBoost =
    typeof metadata.radarRefereeBoost === "number" ? metadata.radarRefereeBoost : null;
  const minSample =
    typeof metadata.minSampleMatches === "number" ? metadata.minSampleMatches : null;

  return {
    matchId: row.matchId,
    competitionId: row.competitionId,
    kickoff: row.kickoffAt,
    status: row.status,
    homeTeam: { id: row.homeTeamId, name: row.homeTeamName },
    awayTeam: { id: row.awayTeamId, name: row.awayTeamName },
    radarScore: row.radarScore,
    confidenceScore: row.confidenceScore,
    confidenceLevel: row.confidenceLevel,
    dimensions: row.dimensions,
    reasons: showFull ? row.reasons : row.reasons.slice(0, 2),
    referee: row.referee ?? null,
    refereeBoost,
    dataQuality: {
      completeness: row.dataCompleteness,
      confidenceScore: row.confidenceScore,
      confidenceLevel: row.confidenceLevel,
      sampleMatches: minSample
    },
    teams,
    matchupInsights: showFull ? matchupInsights : matchupInsights.slice(0, 8),
    matchupSampleNote,
    modelVersion: row.modelVersion,
    calculatedAt:
      typeof metadata.calculatedAt === "string"
        ? metadata.calculatedAt
        : row.calculationMetadata?.processingDurationMs != null
          ? undefined
          : undefined
  };
}

export function extractListHighlightsFromComputed(row: MatchRadarComputed): MatchRadarListHighlights | null {
  const metadata = row.calculationMetadata ?? {};
  const teams = readStoredTeamContext(metadata);
  return buildListHighlights(teams.home, teams.away);
}
