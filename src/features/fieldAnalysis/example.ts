/**
 * Analisi di Campo — Esempio di chiamata
 *
 * Esegui con:  npx tsx src/features/fieldAnalysis/example.ts
 */

import { generateFieldAnalysis } from "./fieldAnalysis";
import {
  mockAwayTeam,
  mockHomeTeam,
  mockLeagueAverages,
  mockMatchContext
} from "./fieldAnalysis.mock";

const result = generateFieldAnalysis({
  matchContext: mockMatchContext,
  homeTeam: mockHomeTeam,
  awayTeam: mockAwayTeam,
  leagueAverages: mockLeagueAverages
});

console.log(JSON.stringify(result, null, 2));
