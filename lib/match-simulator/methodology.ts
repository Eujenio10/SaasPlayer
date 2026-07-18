import type { ExpectedMatchMetrics } from "@/lib/match-simulator/expected";

import type {

  CompetitionMetricProfile,

  MatchSimulationResult,

  RefereeProfile,
  SimulationCalibration,

  SimulationHistoricalValidation,

  SimulationMethodology,

  TeamMethodologySample,

  TeamSimulationProfile

} from "@/lib/match-simulator/types";



export type { SimulationMethodology, TeamMethodologySample };



function goalSourceLabel(source: SimulationCalibration["goalSource"]): string {

  switch (source) {

    case "xg":

      return "xG FootAPI (entrambe le squadre)";

    case "blend":

      return "mix xG + tiri reali";

    default:

      return "tiri e conversione storica";

  }

}



function teamSample(profile: TeamSimulationProfile): TeamMethodologySample {

  return {

    sampleMatches: profile.sampleMatches,

    dataCompleteness: profile.dataCompleteness,

    expectedGoalsCoverage: profile.season.expectedGoalsCoverage ?? 0,

    seasonAverages: {

      goals: profile.season.goalsFor,

      shots: profile.season.shotsFor,

      fouls: profile.season.foulsCommitted,

      possession: profile.season.possession

    },

    recentAverages: {

      goals: profile.recent.goalsFor,

      shots: profile.recent.shotsFor,

      fouls: profile.recent.foulsCommitted,

      expectedGoals: profile.recent.expectedGoalsFor ?? null

    }

  };

}



export function buildSimulationMethodology(params: {

  home: TeamSimulationProfile;

  away: TeamSimulationProfile;

  competition: CompetitionMetricProfile;

  expected: ExpectedMatchMetrics;

  calibration?: SimulationCalibration;
  historicalValidation?: SimulationHistoricalValidation | null;
  referee?: RefereeProfile | null;
  simulation: Pick<

    MatchSimulationResult,

    "simulationsCount" | "dataWarnings" | "refereeConsidered" | "lineupConsidered" | "reliabilityLabel"

  >;

}): SimulationMethodology {

  const homeSample = teamSample(params.home);

  const awaySample = teamSample(params.away);

  const minSample = Math.min(homeSample.sampleMatches, awaySample.sampleMatches);

  const calibration = params.calibration;

  const validation = params.historicalValidation;



  const improvementHints: string[] = [];



  if (minSample < 8) {

    improvementHints.push(

      "Campione storico limitato: i valori sono calibrati verso la media stagionale reale delle squadre."

    );

  }

  if ((calibration?.xgCoverageHome ?? 0) < 0.35 || (calibration?.xgCoverageAway ?? 0) < 0.35) {

    improvementHints.push(

      "xG FootAPI parziale o assente: i gol usano conversione da tiri in porta finché il dato xG non copre almeno il 35% delle partite."

    );

  }

  if (homeSample.dataCompleteness < 0.65 || awaySample.dataCompleteness < 0.65) {

    improvementHints.push(

      "Alcune statistiche FootAPI mancano nelle partite analizzate: corner, possesso o falli possono usare valori di default conservativi."

    );

  }

  if (!params.simulation.refereeConsidered) {

    improvementHints.push(

      "Profilo arbitro non disponibile: cartellini e falli non tengono conto del direttore di gara."

    );

  }

  if (!params.simulation.lineupConsidered) {

    improvementHints.push(

      "Formazione ufficiale assente: il modello non applica aggiustamenti tattici da titolari/out."

    );

  }

  if ((validation?.fixturesEvaluated ?? 0) < 3) {

    improvementHints.push(

      "Poche partite concluse nel campione: la validazione retroattiva ha margine di errore più ampio."

    );

  }



  return {

    summary:

      "Il modello combina xG (quando disponibile), profili offensivi/difensivi delle squadre e calibrazione sulle partite già giocate, per avvicinare le medie ai valori realistici.",

    pipeline: [

      {

        step: "1. Storico squadre",

        detail: `Casa: ${homeSample.sampleMatches} partite (${Math.round(homeSample.dataCompleteness * 100)}% complete, xG ${Math.round((homeSample.expectedGoalsCoverage ?? 0) * 100)}%). Ospite: ${awaySample.sampleMatches} partite (${Math.round(awaySample.dataCompleteness * 100)}% complete, xG ${Math.round((awaySample.expectedGoalsCoverage ?? 0) * 100)}%).`

      },

      {

        step: "2. Attacco vs difesa avversaria",

        detail: calibration

          ? `Gol/tiri: 38% produzione + 38% concessioni avversario + 24% coerenza. Falli: commessi + subiti dall'avversario. Fonte gol: ${goalSourceLabel(calibration.goalSource)}.`

          : "Ogni metrica combina produzione propria e ciò che l'avversario concede o subisce."

      },

      {

        step: "3. Validazione retroattiva",

        detail: validation

          ? `${validation.note} Score calibrazione ${Math.round(validation.calibrationScore)}/100. Totale gol/tiri/falli limitato alla somma realistica delle medie stagionali.`

          : "Budget partita: il totale atteso non supera la somma delle medie stagionali (×0.86 gol, ×0.90 tiri)."

      },

      {

        step: "4. Simulazione Monte Carlo",

        detail: `${params.simulation.simulationsCount.toLocaleString("it-IT")} scenari. Preferisci mediana e P25–P75 rispetto alla sola media.`

      }

    ],

    competitionBaselines: {

      goalsPerMatch: params.competition.goalsPerTeamMatch,

      shotsPerMatch: params.competition.shotsPerTeamMatch,

      foulsPerMatch: params.competition.foulsPerTeamMatch,

      possessionAverage: params.competition.possessionAverage

    },

    expectedBeforeSimulation: {

      home: {
        goals: params.expected.homeGoals,
        shots: params.expected.homeShots,
        fouls: params.expected.homeFouls,
        possession: params.expected.homePossession,
        corners: params.expected.homeCorners,
        shotsOnTarget: params.expected.homeShotsOnTargetExpected,
        saves: params.expected.homeSavesExpected,
        offsides: params.expected.homeOffsides,
        yellowCards: params.expected.homeYellowCardsExpected
      },
      away: {
        goals: params.expected.awayGoals,
        shots: params.expected.awayShots,
        fouls: params.expected.awayFouls,
        possession: 100 - params.expected.homePossession,
        corners: params.expected.awayCorners,
        shotsOnTarget: params.expected.awayShotsOnTargetExpected,
        saves: params.expected.awaySavesExpected,
        offsides: params.expected.awayOffsides,
        yellowCards: params.expected.awayYellowCardsExpected
      }
    },

    homeSample,

    awaySample,

    monteCarloNote:

      "I valori attesi al passo 2–3 sono calibrati sulle medie stagionali reali. Se la media Monte Carlo differisce leggermente, usa mediana e range P25–P75 come riferimento operativo.",

    improvementHints,

    calibration,

    historicalValidation: validation ?? undefined

  };

}


