# Tactical Intelligence Hub — App mobile (Expo)

App iOS/Android per consultare analisi tattiche, partite e rischio ammonizioni. Usa **Expo SDK 54**, allineato a **Expo Go** dall'App Store / Play Store.

## Requisiti

- Node.js **20+** (consigliato, allineato al progetto web)
- [Expo Go](https://expo.dev/go) installato su iPhone o Android
- Backend web avviato (`npm run dev` nella root del repo)
- PC e telefono sulla **stessa rete Wi‑Fi** (per test su dispositivo fisico)

## Configurazione

1. Copia le variabili d'ambiente:

   ```bash
   cd mobile
   cp .env.example .env
   ```

2. Compila `.env` con:
   - `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (stessi valori del web)
   - `EXPO_PUBLIC_API_URL` = indirizzo del server Next.js **visto dal telefono**

   | Scenario | `EXPO_PUBLIC_API_URL` |
   |----------|------------------------|
   | Dispositivo fisico + Expo Go | `http://IP_LAN_PC:3000` |
   | Emulatore Android | `http://10.0.2.2:3000` |
   | Simulatore iOS (Mac) | `http://localhost:3000` |

3. Installa dipendenze (se non già fatto):

   ```bash
   npm install
   ```

## Avvio con Expo Go

1. Nella root del repo, avvia il backend:

   ```bash
   npm run dev
   ```

2. Nella cartella `mobile`:

   ```bash
   npm start
   ```

   **Importante:** usa `npm start` (modalità LAN). Non usare `npm run start:offline` se scansioni il QR da telefono: con `--offline` Expo disabilita la rete e il telefono non riesce a scaricare il bundle.

3. Scansiona il QR code con:
   - **Android**: app Expo Go
   - **iOS**: fotocamera → apri in Expo Go

4. Accedi con le stesse credenziali dell'area web.

## Il QR non carica l'app?

1. **Server Expo attivo** — nel terminale deve comparire il QR e *nessun* messaggio tipo `Skipping dev server`. Se la porta 8081 è occupata, chiudi l'altro processo Node (o riavvia il PC) e rilancia `npm start`.
2. **Modalità LAN** — avvia con `npm start` (non `start:offline`). Con `--offline` compare `Networking has been disabled` e il telefono non si connette.
3. **Stessa Wi‑Fi** — PC e telefono sulla stessa rete (niente dati mobili / rete ospiti isolata).
4. **Firewall Windows** — consenti Node.js sulla rete privata (porta **8081** per Metro, **3000** per il backend Next.js).
5. **Rete difficile** — prova `npm run start:tunnel` (più lento, ma funziona anche fuori LAN).
6. **Expo Go aggiornato** — l'app richiede Expo Go compatibile con SDK 54.
7. **`EXPO_PUBLIC_API_URL`** — deve essere l'IP LAN del PC (es. `http://192.168.1.12:3000`), non `localhost`. Verifica con `ipconfig` che l'IP coincida con `mobile/.env`.

## Schermate

- **Home** — panoramica e accesso rapido ai moduli
- **Partite** — elenco partite e analisi giocatori per evento
- **Ammonizioni** — Top 10 rischio cartellino (con limiti piano Member)
- **Profilo** — piano, quota settimanale, logout

## Note tecniche

- L'app invia il JWT Supabase come `Authorization: Bearer` alle API `/api/*`.
- I ruoli `admin`, `pro` e `member` seguono le stesse regole del prodotto web.
- Per build di produzione (App Store / Play Store) servirà EAS Build; Expo Go è solo per sviluppo e test.
