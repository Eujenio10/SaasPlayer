/**
 * Simulatore match sospeso.
 *
 * Interruttore unico condiviso da web, app e job: nasconde gli accessi utente e
 * ferma la rigenerazione automatica delle simulazioni. Codice, API e dati
 * restano intatti, quindi per riattivare la funzionalità basta rimettere `true`
 * (l'app mobile richiede comunque un nuovo build, perché la tab è nel bundle).
 */
export const MATCH_SIMULATOR_ENABLED = false;
