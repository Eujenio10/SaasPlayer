export const PITCHBRAIN_LOADING_JOKES = [
  "Stiamo interrogando il centrocampo…",
  "Un attimo, il VAR sta controllando.",
  "Cerchiamo chi farà più falli… 👀",
  "Il terzino sta ancora tornando.",
  "Analizziamo tutto. Anche quello che l’arbitro non vede.",
  "Aspetta, qualcuno ha perso la marcatura.",
  "Il centrocampo è sotto interrogatorio.",
  "Stiamo contando i duelli. Sono parecchi.",
  "Nessun allenatore è stato disturbato durante l’analisi.",
  "I dati stanno facendo riscaldamento.",
  "Il modello sta guardando la partita. Niente popcorn.",
  "Cerchiamo spazio tra le linee…",
  "Un secondo: il pressing non si misura da solo.",
  "La tattica sta tatticando."
] as const;

export type PitchBrainLoadingJoke = (typeof PITCHBRAIN_LOADING_JOKES)[number];

export function pickLoadingMessage(exclude?: string | null): string {
  const pool =
    exclude != null
      ? PITCHBRAIN_LOADING_JOKES.filter((line) => line !== exclude)
      : PITCHBRAIN_LOADING_JOKES;
  const list = pool.length > 0 ? pool : PITCHBRAIN_LOADING_JOKES;
  const index = Math.floor(Math.random() * list.length);
  return list[index] ?? PITCHBRAIN_LOADING_JOKES[0];
}
