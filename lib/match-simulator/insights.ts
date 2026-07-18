import { translateTeamName } from "@/lib/italian-sports-display-core";
import type { ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import type {
  CompetitionMetricProfile,
  MatchPhysicalityProfile,
  MatchTempoProfile,
  SimulationInsight,
  TeamSimulationProfile,
  TeamSimulationSideResult
} from "@/lib/match-simulator/types";

export function buildDeterministicInsights(params: {
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  competition: CompetitionMetricProfile;
  expected: ExpectedMatchMetrics;
  homeTeam: TeamSimulationSideResult;
  awayTeam: TeamSimulationSideResult;
  tempo: MatchTempoProfile;
  physicality: MatchPhysicalityProfile;
  metricReliability: { fouls: number; yellowCards: number; goals: number };
}): SimulationInsight[] {
  const insights: SimulationInsight[] = [];
  const homeName = translateTeamName(params.homeTeam.teamName ?? "Squadra di casa");
  const awayName = translateTeamName(params.awayTeam.teamName ?? "Squadra ospite");

  if (params.homeTeam.shots.mean > params.home.season.shotsFor * 1.08) {
    insights.push({
      id: "home_shots_above_season",
      category: "attack",
      text: `${homeName} è stimata sopra la propria media stagionale di tiri.`
    });
  }

  if (params.awayTeam.shots.mean > params.away.season.shotsFor * 1.08) {
    insights.push({
      id: "away_shots_above_season",
      category: "attack",
      text: `${awayName} è stimata sopra la propria media stagionale di tiri.`
    });
  }

  if (params.homeTeam.saves.mean > params.competition.savesPerTeamMatch * 1.12) {
    insights.push({
      id: "home_gk_busy",
      category: "goalkeeper",
      text: `Il portiere di ${homeName} potrebbe essere maggiormente impegnato per il volume di conclusioni previsto.`
    });
  }

  if (params.awayTeam.saves.mean > params.competition.savesPerTeamMatch * 1.12) {
    insights.push({
      id: "away_gk_busy",
      category: "goalkeeper",
      text: `Il portiere di ${awayName} potrebbe essere maggiormente impegnato per il volume di conclusioni previsto.`
    });
  }

  const combinedFouls =
    params.expected.homeFouls + params.expected.awayFouls;
  if (combinedFouls > params.competition.foulsPerTeamMatch * 2 * 1.08) {
    insights.push({
      id: "physicality_above_avg",
      category: "physicality",
      text: "La combinazione tra falli commessi dalle due squadre e falli subiti dagli avversari produce un’intensità fisica sopra la media del campionato."
    });
  }

  if (
    params.metricReliability.yellowCards >= 0.5 &&
    params.homeTeam.yellowCards.mean + params.awayTeam.yellowCards.mean >
      params.competition.yellowCardsPerTeamMatch * 2 * 1.1
  ) {
    insights.push({
      id: "yellow_cards_elevated",
      category: "discipline",
      text: "Il numero atteso di cartellini è elevato, ma la metrica presenta una variabilità superiore rispetto a tiri e possesso."
    });
  }

  if (params.home.playStyle.labels.includes("possession_dominant")) {
    insights.push({
      id: "home_possession_style",
      category: "possession",
      text: `${homeName} mostra un profilo orientato al controllo del possesso rispetto alla media del campionato.`
    });
  }

  if (params.tempo.label === "high" || params.tempo.label === "very_high") {
    insights.push({
      id: "high_tempo",
      category: "general",
      text: "Il ritmo previsto della partita è superiore alla media, con maggiore volume di azioni offensive simulate."
    });
  }

  return insights.slice(0, 6);
}
