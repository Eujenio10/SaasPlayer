# Tactical Intelligence Hub

Web-app editoriale B2B in Next.js 14 per analisi tattica calcistica in tempo reale.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Auth, PostgreSQL, Realtime)
- Tailwind CSS + Framer Motion
- Pagamenti manuali con bonifico (workflow admin)
- RapidAPI Sport data (Pure Tactical Analytics)

## Avvio

1. Copia `.env.example` in `.env.local` e compila le variabili.
2. Installa dipendenze:
   - `npm install`
3. Avvia:
   - `npm run dev`

## Sicurezza B2B

- Accesso alle rotte `/display` e `/kiosk` consentito solo con sessione Supabase valida.
- Membership obbligatoria tramite `organization_users`.
- Blocco accesso se membership assente o IP non conforme.
- Blocco accesso se subscription non operativa (status diverso da `active/trialing` o periodo scaduto).
- RLS hardening multi-tenant:
  - helper SQL `is_org_member` e `is_org_admin`
  - policy granulari select/insert/update/delete su `organization_users`, `player_stats`, `subscriptions`
  - update `organizations` consentito solo ad admin dell'organizzazione
- Whitelist IP supporta:
  - `organizations.allowed_ip` (single IP o lista separata da virgole)
  - `organizations.allowed_ip_ranges` (array CIDR/IP, es. `192.168.1.0/24`)
- Trust proxy configurabile con `IP_TRUST_PROXY` e `IP_TRUSTED_PROXY_HOPS`.
- Grace period subscription configurabile con `SUBSCRIPTION_GRACE_DAYS`.
- Audit log accessi in `access_audit_logs`.
- Pipeline snapshot realtime:
  - endpoint consolidato `GET /api/tactical/snapshot`
  - persistenza in `tactical_snapshots`
  - refresh live su `/display` e `/kiosk` via Supabase Realtime.

## Schema SQL

Lo schema Supabase e disponibile in `supabase/schema.sql`.
Seed iniziale organizzazione/admin in `supabase/seed.sql`.

## Configurazione snapshot

- `TACTICAL_DEFAULT_FIXTURE_ID` fixture di default per il feed. Se imposti un valore non numerico (es. `auto-live`) il backend attiva auto-discovery del match calcio da SportAPI.
- `TACTICAL_SNAPSHOT_MAX_AGE_SECONDS` eta massima snapshot prima del refresh automatico.
- `SPORTAPI_FOOTBALL_SCHEDULED_EVENTS_PATH` endpoint principale per eventi programmati calcio (con `{date}`) usato per calcolare la prossima giornata.
- `TACTICAL_LOOKAHEAD_DAYS` finestra giorni per trovare la prossima giornata (default `14`).
- `TACTICAL_TEAM_SEARCH_LOOKAHEAD_DAYS` finestra giorni usata per indicizzare i club ricercabili (default `14`).
- `TACTICAL_TEAM_SEARCH_REFRESH_HOURS` frequenza refresh indice squadre ricerca (default `96`, cioe ogni 4 giorni).
- `TACTICAL_TOP5_LEAGUE_IDS` lista League ID dei Top5 campionati consentiti (CSV).
- `TACTICAL_SERIE_A_LEAGUE_ID` League ID usato per priorita alta Serie A.
- `TACTICAL_BLUEPRINT_REFRESH_DAYS` giorni minimi prima di consentire un refresh blueprint (default `10`).
- `TACTICAL_BLUEPRINT_NEXT_MATCH_WINDOW_DAYS` finestra prossima partita per sbloccare refresh (default `2`).
- `TACTICAL_DAILY_API_BUDGET` budget giornaliero chiamate provider (default `450`).
- `TACTICAL_MONTHLY_API_BUDGET` hard cap mensile chiamate provider (default `14500`).
- `TACTICAL_MINOR_COMPETITION_THRESHOLD_PCT` soglia percentuale oltre la quale i refresh minori vengono bloccati (default `80`).
- `TACTICAL_MATCH_INSIGHTS_CACHE_HOURS` cache TTL endpoint bulk match insights (default `24`).
- `TACTICAL_TEAM_SEARCH_QUERY_CACHE_HOURS` cache TTL risultati query ricerca squadre (default `48`).
- Con host `sportapi7.p.rapidapi.com` usa endpoint con prefisso `/api/v1` (es. `/api/v1/sport/football/scheduled-events/{date}`).

### Logica editoriale auto-live

- In modalita `auto-live`, il sistema analizza solo:
  - Top 5 campionati europei (`premier-league`, `serie-a`, `laliga`, `bundesliga`, `ligue-1`)
  - `uefa-champions-league`
  - `uefa-europa-league`
- Per ogni competizione seleziona **solo la prossima giornata/round** disponibile (non solo le gare del giorno corrente).
- I dati club restano sempre presenti: se mancano lineup/statistiche evento, viene usato fallback roster squadra per non svuotare la vista.
- Nel modulo `Deep Team Performance Blueprint` e disponibile la ricerca squadra dedicata (`/api/tactical/team-search`) limitata a club Top5.
- Il refresh blueprint avviene solo se:
  - sono passati almeno `TACTICAL_BLUEPRINT_REFRESH_DAYS` giorni dall'ultimo aggiornamento;
  - la squadra ha una partita utile entro `TACTICAL_BLUEPRINT_NEXT_MATCH_WINDOW_DAYS` giorni.
- Priority queue: Champions League e Serie A hanno priorita alta; le competizioni minori vengono congelate quando il budget giornaliero e vicino al limite.
- Ogni chiamata provider viene loggata in `api_usage` per monitoraggio consumi.

## Pure Tactical Models

- FirepowerIndex (Momentum) basato su:
  - media tiri ultime 2 gare / media tiri stagionale
  - moltiplicatore difesa avversaria (shots conceded normalizzati).
- SparkDetector (Friction Zone) con:
  - overlap heatmap
  - trigger falli commessi/subiti
  - narrativa editoriale dinamica.
- WallIndex (Stress Portiere) incrociando:
  - xG creati dall'attacco avversario
  - save percentage portiere.

## Compliance legale e GDPR

- Footer legale fisso su tutte le pagine con disclaimer Decreto Dignita.
- Pagine legali dedicate:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/data-processing`
- Registro trattamenti e retention:
  - `processing_activities`
  - `data_retention_policies`
  - `compliance_events`
- Endpoint operativo admin per applicare retention: `POST /api/compliance/retention`.

## Pagamenti con bonifico (senza Stripe)

- Pannello admin: `/admin/subscriptions`.
- API gestione manuale: `POST /api/admin/subscriptions`.
- API registrazione nuova agenzia: `POST /api/admin/organizations`.
- Selezione centro nel pannello con dropdown (gestione per singola organizzazione).
- Registrazione agenzia dal pannello:
  - crea `organizations`
  - assegna admin iniziale
  - inizializza `subscriptions`
  - crea setup compliance (`data_retention_policies`, `processing_activities`).
- Azioni disponibili:
  - `activate` (attiva)
  - `renew` (rinnova)
  - `suspend` (sospendi)
- Piani disponibili con durata associata:
  - `prova` -> 7 giorni
  - `mensile` -> 30 giorni
  - `bimensile` -> 60 giorni
  - `trimensile` -> 90 giorni
  - `semestrale` -> 180 giorni
  - `annuale` -> 365 giorni
- Ogni operazione registra evento in `compliance_events` per tracciabilita.

## Hardening watermark e kiosk

- Watermark dinamico con nome organizzazione + identificativo sessione.
- Runtime guard client:
  - monitora rimozione overlay via MutationObserver
  - ricostruisce watermark se manomesso
  - invia heartbeat su `POST /api/security/heartbeat`.
- Kiosk controls:
  - prompt fullscreen assistito
  - blocco menu contestuale
  - blocco shortcut sensibili (es. F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Ctrl+P).

## Desktop-only enforcement

- Middleware blocca user-agent mobile su `/display` e `/kiosk` con redirect `/desktop-only`.
- Guard client su viewport minima nelle pagine protette.
- Nessuna funzionalita di share/export/QR prevista nell'applicazione.
