/**
 * Analisi di Campo — Entry point pubblico.
 *
 * Importa da qui per collegare la feature a una schermata (web o React Native):
 *
 *   import { generateFieldAnalysis, type FieldAnalysisResult } from "@/features/fieldAnalysis";
 */

export { generateFieldAnalysis, deduplicateSimilarInsights } from "./fieldAnalysis";
export { findForbiddenWords, FORBIDDEN_WORDS } from "./fieldAnalysis.text";
export * from "./fieldAnalysis.types";
export {
  mockFieldAnalysisInput,
  mockHomeTeam,
  mockAwayTeam,
  mockLeagueAverages,
  mockMatchContext,
  mockReferee
} from "./fieldAnalysis.mock";
