/**
 * Beta pubblica "PitchBrain Beta": tutte le funzionalità sono gratuite per chiunque usi
 * l'app, guest incluso — nessuna distinzione tra Guest, Free e Pro lato UI/feature-gating.
 * Specchia lato client il flag server `PITCHBRAIN_BETA_FREE_FOR_ALL`
 * (lib/entitlements/config.ts). Impostare a `false` per tornare al modello Free/Pro reale
 * (richiede una nuova build, essendo un valore compilato nel bundle).
 */
export const PITCHBRAIN_BETA_FREE_FOR_ALL = true;
