/** Solo lettura tattica: niente pronostici, mercati o allusione al gioco d'azzardo. */
export const PITCHBRAIN_LOADING_JOKES_IT = [
  "Stiamo interrogando il centrocampo…",
  "Un attimo, il VAR sta controllando.",
  "Stiamo rileggendo i contrasti in mezzo al campo.",
  "Il terzino sta ancora tornando.",
  "Stiamo allineando le letture tattiche.",
  "Aspetta, qualcuno ha perso la marcatura.",
  "Il centrocampo è sotto interrogatorio.",
  "Stiamo mappando i duelli. Sono parecchi.",
  "Nessun allenatore è stato disturbato durante l’analisi.",
  "I dati stanno facendo riscaldamento.",
  "Il modello sta guardando la partita. Niente popcorn.",
  "Cerchiamo spazio tra le linee…",
  "Un secondo: il pressing non si misura da solo.",
  "La tattica sta tatticando."
] as const;

export const PITCHBRAIN_LOADING_JOKES_EN = [
  "We're questioning midfield…",
  "One moment, VAR is checking.",
  "We're re-reading the challenges in the middle.",
  "The full-back is still tracking back.",
  "We're lining up the tactical reads.",
  "Wait, someone lost their marker.",
  "Midfield is under questioning.",
  "We're mapping the duels. There are quite a few.",
  "No coach was disturbed during this analysis.",
  "The data is warming up.",
  "The model is watching the match. No popcorn.",
  "Looking for space between the lines…",
  "One second: pressing doesn't measure itself.",
  "The tactics are tactic-ing."
] as const;

export const PITCHBRAIN_LOADING_JOKES = PITCHBRAIN_LOADING_JOKES_IT;

export type PitchBrainLoadingJoke = (typeof PITCHBRAIN_LOADING_JOKES)[number];

/** Avanzamento stimato quando l’API non invia una percentuale reale. */
export function estimateLoadingProgress(elapsedMs: number): number {
  const seconds = Math.max(0, elapsedMs) / 1000;
  if (seconds <= 7) {
    return (0.72 * seconds) / 7;
  }
  if (seconds <= 16) {
    return 0.72 + (0.16 * (seconds - 7)) / 9;
  }
  const crawl = 0.11 * (1 - Math.exp(-(seconds - 16) / 22));
  return Math.min(0.99, 0.88 + crawl);
}

export function formatLoadingPercent(progress: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return `${pct}%`;
}

export function pickLoadingMessage(exclude?: string | null, locale: "it" | "en" = "it"): string {
  const jokes = locale === "en" ? PITCHBRAIN_LOADING_JOKES_EN : PITCHBRAIN_LOADING_JOKES_IT;
  const pool = exclude != null ? jokes.filter((line) => line !== exclude) : jokes;
  const list = pool.length > 0 ? pool : jokes;
  const index = Math.floor(Math.random() * list.length);
  return list[index] ?? jokes[0];
}
