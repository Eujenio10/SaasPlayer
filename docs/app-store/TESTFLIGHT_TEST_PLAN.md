# TestFlight Test Plan — PitchBrain iOS

Eseguire su build **preview/production** (non Expo Go) dopo integrazione IAP/AdMob.

## Installazione e base

- [ ] Installazione pulita da TestFlight
- [ ] Primo avvio / splash
- [ ] Guest: home e moduli Free caricano
- [ ] Rete assente: messaggio errore gestito (no crash)
- [ ] Backend down: errore API gestito

## Account

- [ ] Registrazione email/password
- [ ] Login
- [ ] Logout
- [ ] Recupero password (se abilitato in Supabase; altrimenti documentare assenza)
- [ ] **Elimina account** da Profilo → conferma → account non più utilizzabile
- [ ] Re-registrazione stessa email (policy Supabase)

## Dati e schermate

- [ ] Home dashboard
- [ ] Elenco partite
- [ ] Dettaglio partita / intensità / form
- [ ] Marcature / trend / simulatore (Free preview vs Pro)
- [ ] Profilo mostra piano corretto

## Ads

- [ ] Rewarded disponibile → unlock match
- [ ] Limite giornaliero rispettato
- [ ] Ads non disponibili → messaggio chiaro, no soft-lock
- [ ] Production: nessuna sample unit Google

## Pro / IAP

- [ ] Paywall richiede account se guest
- [ ] Acquisto Sandbox mensile → stato Pro
- [ ] Restore purchases
- [ ] Gestisci abbonamento (deep link Impostazioni se presente)
- [ ] Scadenza / cancel Sandbox → ritorno Free (webhook)

## Privacy / review

- [ ] Nessuna richiesta ATT al cold start senza contesto (oggi ATT assente)
- [ ] Copy senza linguaggio scommesse nelle schermate principali
- [ ] Deep link `tactical-hub://` (smoke)

## Device matrix

- [ ] iPhone piccolo (SE class)
- [ ] iPhone standard
- [ ] iPhone Pro Max
- [ ] iPad (supportsTablet true) — smoke

## Qualità

- [ ] Nessun crash in percorso felice
- [ ] Scroll/liste accettabili
- [ ] Aggiornamento da build precedente (quando esisterà v1.0.1)
