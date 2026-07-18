/**
 * Analisi di Campo — Test base (eseguibili senza framework)
 *
 * Esegui con:  npx tsx src/features/fieldAnalysis/fieldAnalysis.test.ts
 *
 * I test usano semplici assert e stampano l'esito. Non dipendono da Jest/Vitest
 * così da poter girare anche in ambienti senza test runner configurato.
 */

import { generateFieldAnalysis } from "./fieldAnalysis";
import {
  mockAwayTeam,
  mockFieldAnalysisInput,
  mockHomeTeam,
  mockLeagueAverages,
  mockMatchContext
} from "./fieldAnalysis.mock";
import { MAX_INSIGHTS, MIN_MISMATCH_SCORE } from "./fieldAnalysis.types";
import { findForbiddenWords } from "./fieldAnalysis.text";

type TestResult = { name: string; passed: boolean; detail?: string };

const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

/* ------------------------------------------------------------------ */
/* 1-8: requisiti funzionali                                           */
/* ------------------------------------------------------------------ */

const analysis = generateFieldAnalysis(mockFieldAnalysisInput);

// 1. Massimo 7 insight.
check(
  "1. Restituisce al massimo 7 insight",
  analysis.insights.length <= MAX_INSIGHTS,
  `attesi <= ${MAX_INSIGHTS}, ottenuti ${analysis.insights.length}`
);

// 2. Nessun insight sotto la soglia di 60.
check(
  "2. Nessun insight sotto la soglia minima",
  analysis.insights.every((i) => i.mismatchScore >= MIN_MISMATCH_SCORE),
  `score minimo trovato: ${Math.min(...analysis.insights.map((i) => i.mismatchScore))}`
);

// 3. Tutti gli score sono tra 0 e 100.
check(
  "3. Score compresi tra 0 e 100",
  analysis.insights.every((i) => i.mismatchScore >= 0 && i.mismatchScore <= 100),
  "trovato score fuori range"
);

// 4. Non crasha con dati mancanti.
let noCrash = true;
try {
  const minimalTeam = {
    teamId: "x",
    teamName: "Squadra X",
    seasonStats: { ...mockHomeTeam.seasonStats, matchesPlayed: 2 },
    last5Stats: mockHomeTeam.last5Stats,
    last10Stats: mockHomeTeam.last10Stats
  } as typeof mockHomeTeam;
  const minimalAway = {
    teamId: "y",
    teamName: "Squadra Y",
    seasonStats: { ...mockAwayTeam.seasonStats, matchesPlayed: 2 },
    last5Stats: mockAwayTeam.last5Stats,
    last10Stats: mockAwayTeam.last10Stats
  } as typeof mockAwayTeam;
  generateFieldAnalysis({
    matchContext: { ...mockMatchContext, referee: undefined },
    homeTeam: minimalTeam,
    awayTeam: minimalAway,
    leagueAverages: mockLeagueAverages
  });
} catch (error) {
  noCrash = false;
  check("4. Nessun crash con dati mancanti", false, String(error));
}
if (noCrash) check("4. Nessun crash con dati mancanti", true);

// 5. Genera insight in entrambe le direzioni (per entrambe le squadre).
const teamsWithInsights = new Set(analysis.insights.map((i) => i.team));
check(
  "5. Insight generati in entrambe le direzioni",
  teamsWithInsights.has(mockHomeTeam.teamName) && teamsWithInsights.has(mockAwayTeam.teamName),
  `squadre presenti: ${[...teamsWithInsights].join(", ")}`
);

// 6. Ordinamento per score decrescente.
let sorted = true;
for (let i = 1; i < analysis.insights.length; i += 1) {
  if (analysis.insights[i].mismatchScore > analysis.insights[i - 1].mismatchScore) sorted = false;
}
check("6. Insight ordinati per score decrescente", sorted);

// 7. Confidence coerente con il livello di reliability (range plausibili).
const confidenceValues = new Set(analysis.insights.map((i) => i.confidence));
check(
  "7. Confidence valorizzata e coerente",
  analysis.insights.every((i) =>
    ["bassa", "discreta", "buona", "alta"].includes(i.confidence)
  ),
  `valori confidence: ${[...confidenceValues].join(", ")}`
);

// 8. Ogni insight ha evidence e keyStats.
check(
  "8. Ogni insight ha evidence e keyStats",
  analysis.insights.every((i) => i.evidence.length > 0 && i.keyStats.length > 0),
  "trovato insight senza evidence o keyStats"
);

// Extra: nessuna parola vietata nei testi.
const allText = analysis.insights
  .flatMap((i) => [
    i.title,
    i.tacticalMeaning,
    i.summary,
    ...i.evidence,
    ...i.keyStats.map((k) => k.label),
    ...i.keyStats.map((k) => k.interpretation),
    ...(i.warnings ?? [])
  ])
  .concat(analysis.globalSummary)
  .join(" ");
const forbiddenFound = findForbiddenWords(allText);
check(
  "Extra. Nessuna parola vietata nei testi",
  forbiddenFound.length === 0,
  `parole trovate: ${forbiddenFound.join(", ")}`
);

// Extra: livello coerente con lo score.
check(
  "Extra. Level coerente con lo score",
  analysis.insights.every((i) => {
    if (i.mismatchScore >= 85) return i.level === "molto_alto";
    if (i.mismatchScore >= 75) return i.level === "alto";
    return i.level === "interessante";
  }),
  "level non coerente con mismatchScore"
);

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const passedCount = results.filter((r) => r.passed).length;
for (const result of results) {
  const status = result.passed ? "PASS" : "FAIL";
  const detail = result.detail ? ` -> ${result.detail}` : "";
  console.log(`[${status}] ${result.name}${detail}`);
}
console.log(`\n${passedCount}/${results.length} test superati.`);
console.log(`Insight generati: ${analysis.insights.length}`);

if (passedCount !== results.length) {
  if (typeof process !== "undefined" && typeof process.exit === "function") {
    process.exitCode = 1;
  }
}

export { analysis as sampleAnalysis };
