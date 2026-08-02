# App Privacy Inventory — PitchBrain (iOS)

Inventario basato sul codice analizzato il 2026-07-19. Dove non determinabile: **da verificare**.

| Tipo dato | Punto codice | Finalità | Collegato a identità | Tracking | Conservazione | Destinatario | SDK | Dichiarazione ASC |
|-----------|--------------|----------|----------------------|----------|---------------|--------------|-----|-------------------|
| Email account | `AuthContext` / Supabase Auth | Account, login | Sì | No | Finché account esiste | Supabase | `@supabase/supabase-js` | Contact Info — Email |
| User ID (UUID) | sessione JWT, API Bearer | Auth API, entitlements, IAP appUserID | Sì | No | Finché account esiste | Backend + Supabase + RevenueCat (se IAP) | Supabase, RevenueCat (previsto) | User ID |
| Password | signup/login (non persistita in chiaro) | Auth | Sì | No | Hash lato Supabase | Supabase | Supabase | Non dichiarare come raccolta password in chiaro |
| Device ID | `mobile/lib/device-id.ts` + header `X-Device-Id` | Guest entitlements / anti-abuse soft ads | Soft (device) | No (se non usato cross-app) | Locale SecureStore + backend guest rows | Backend PitchBrain | custom | Device ID — da verificare usage |
| JWT access token | SecureStore / Authorization header | Chiamate API | Sì | No | Sessione | Backend | Supabase | — |
| Utilizzo funzioni / unlock match | entitlements API | Limiti Free, analytics interni | Sì se loggato | No | DB entitlements | Backend | custom | Product Interaction — da verificare |
| Acquisti / abbonamento Pro | IAP + webhook RC + `iap-sync` | Monetizzazione | Sì | No | `user_pro_subscriptions` | Apple, RevenueCat, Backend | StoreKit via RC | Purchases |
| Diagnostica crash | non trovata libreria dedicata | — | — | — | — | — | nessuno rilevato | Non dichiarare se assente |
| Posizione | non usata | — | — | — | — | — | — | Non dichiarare |
| Contatti / foto / mic | non usati | — | — | — | — | — | — | Non dichiarare |
| IDFA / ATT | non implementato; AdMob NPA flag | Ads | Potenziale se ATT sì | **da verificare** con AdMob reale | SDK AdMob | Google | `react-native-google-mobile-ads` (previsto) | Advertising Data — da verificare dopo integrazione |
| Contenuti generati utente | minimo (email account) | — | Sì | No | — | — | — | — |
| Dati analisi partite | API tattiche | Funzione app | No (catalogo) | No | Backend org snapshots | Backend | custom | — |

## Note

- Non dichiarare “tracking” se non usi dati per pubblicità cross-app di terzi oltre AdMob; **verificare** con policy AdMob/UMP quando integri SDK reale.
- Backend web può usare OddsAPI: **non** risulta esposto nell’UI mobile attuale.
- Dopo installazione AdMob/RevenueCat, aggiornare questa tabella.
