# App Review Notes — bozza

## Scopo

PitchBrain offre analisi statistica ed editoriale sul calcio (partite, indicatori tattici, trend, report). Non consente scommesse, non collega bookmaker e non promette vincite.

## Percorso di prova

1. Aprire l’app (guest consentito per esplorazione Free).
2. Registrarsi / accedere con le credenziali demo fornite.
3. Aprire Home → Partite → dettaglio analisi.
4. (Opzionale) Guardare una rewarded ad per sbloccare un’analisi partita se in piano Free.
5. Profilo: verificare piano; Restore purchases; Elimina account (non usare l’account demo se deve restare attivo).

## Rewarded ads

Le rewarded ads sbloccano temporaneamente analisi partita per utenti Free, entro un limite giornaliero. In sviluppo possono essere simulate; in production usano AdMob.

## Funzioni Pro

Pro sblocca analisi complete illimitate via abbonamento in-app (App Store / RevenueCat). Non usare pagamenti web esterni per sbloccare contenuti digitali iOS.

## Account demo

DA COMPILARE: email / password.

## Eliminazione account

Profilo → **Elimina account** → conferma. Cancella l’utente Auth e i dati collegati via cascade. Gli abbonamenti Apple restano gestibili da Impostazioni → Abbonamenti.

## Chiarimenti

- “Quota” in alcuni testi editoriali indica proporzione statistica, non quote scommesse.
- Eventuali dati odds sul backend non sono il prodotto consumer dell’app mobile.
