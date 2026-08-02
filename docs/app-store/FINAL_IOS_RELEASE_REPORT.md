# Final iOS Release Report — PitchBrain

**Stato complessivo:** `NON PRONTO`  
**Prossimo singolo passaggio:** eseguire `npx eas-cli@latest login` nella cartella `mobile` (intervento utente).  
**Build production:** non avviata (prerequisiti mancanti).  
**Submit:** non avviato.

---

## 1. OPERAZIONI COMPLETATE DA CURSOR

- Analisi progetto mobile (Expo SDK 54 managed/CNG, npm).
- Creato branch `chore/ios-app-store-release` (modifiche icona già presenti non sovrascritte).
- `npx expo-doctor` → inizialmente 2 fail; dopo fix → **18/18 pass**.
- `npx eas-cli whoami` → Not logged in (documentato).
- `npx expo install --check` / upgrade `expo@~54.0.36`.
- Installato `expo-dev-client`.
- Creato `mobile/eas.json` (development / preview / production / submit).
- Aggiornato `mobile/app.json` (PitchBrain, buildNumber, ITSAppUsesNonExemptEncryption false, privacyManifest UserDefaults, plugin `expo-dev-client`).
- Re-encode icone PitchBrain in **PNG reale** (prima erano JPEG con estensione .png).
- Guard production su AdMob sample unit (`rewarded-ads.ts`).
- Implementata eliminazione account: API `POST /api/user/delete-account` (+ mobile alias) + UI Profilo + `AuthContext.deleteAccount`.
- Aggiornato `mobile/.env.example`.
- Generata documentazione in `docs/app-store/`.

## 2. FILE MODIFICATI / CREATI

| File | Motivo |
|------|--------|
| `mobile/app.json` | Nome, iOS plist, plugins, splash |
| `mobile/eas.json` | Profili EAS |
| `mobile/package.json` / lock | expo 54.0.36, expo-dev-client |
| `mobile/assets/images/*` | Icone PNG PitchBrain |
| `mobile/lib/ads/rewarded-ads.ts` | Blocco sample unit in prod |
| `mobile/lib/api.ts` | `deleteUserAccount` |
| `mobile/contexts/AuthContext.tsx` | `deleteAccount` |
| `mobile/app/(tabs)/profile.tsx` | Pulsante elimina account |
| `mobile/.env.example` | Placeholder IAP/AdMob |
| `app/api/user/delete-account/route.ts` | Backend delete |
| `app/api/mobile/user/delete-account/route.ts` | Alias mobile |
| `docs/app-store/*.md` | Audit e checklist |

## 3. TEST ESEGUITI E RISULTATI

| Comando | Risultato |
|---------|-----------|
| `git status` / branch | OK — branch release creato |
| `npx expo-doctor` | OK 18/18 dopo fix |
| `npx expo config --type public` | OK |
| `npx eas-cli whoami` | FAIL auth — login utente richiesto |
| `npm run typecheck` (mobile) | FAIL — path monorepo `@/*` → `../*` tira tipi parent |
| `eas build` production | **Non eseguito** |
| `eas submit` | **Non eseguito** |
| Verifica magic bytes PNG | OK `89 50 4E 47…` |

## 4. OPERAZIONI CHE DEVE FARE L’UTENTE

Vedi `USER_ACTIONS_APPLE.md`. In sintesi:

1. `eas login` + `eas init`
2. Confermare Bundle ID
3. App Store Connect + IAP products
4. RevenueCat + AdMob + env EAS
5. Chiedere a Cursor di installare `react-native-purchases` e `react-native-google-mobile-ads` quando pronto
6. Build development/preview → TestFlight → Review

```text
AZIONE RICHIESTA ALL’UTENTE
Operazione: Login Expo/EAS
Dove: Terminale locale, cartella mobile
Dati necessari: Account Expo (email/password o SSO); non incollare in chat
Comando o percorso: cd mobile && npx eas-cli@latest login && npx eas-cli@latest whoami
Come verificare: whoami stampa username Expo
Impatto se non completata: impossibile build/submit EAS
```

```text
AZIONE RICHIESTA ALL’UTENTE
Operazione: Confermare Bundle Identifier e creare app in App Store Connect
Dove: Decisione prodotto + App Store Connect → Le mie app
Dati necessari: Bundle ID definitivo (attuale repo: com.ildodicesimo.tacticalhub), nome, SKU, lingua
Comando o percorso: App Store Connect UI
Come verificare: App iOS esiste con stesso Bundle ID; annotare App ID numerico
Impatto se non completata: submit bloccato; build possibile ma upload no
```

## 5. BLOCCHI PRIMA DELLA PUBBLICAZIONE

1. EAS non autenticato / progetto non linkato  
2. Pacchetti nativi IAP + AdMob assenti  
3. Env production EAS incomplete  
4. Prodotti subscription App Store Connect mancanti  
5. Metadata/privacy/screenshot/demo account incompleti  
6. Deploy backend della route delete-account da verificare su Vercel  
7. Typecheck mobile monorepo paths da sanare per CI  

## Documenti generati

- `docs/app-store/IOS_RELEASE_AUDIT.md`
- `docs/app-store/USER_ACTIONS_APPLE.md`
- `docs/app-store/APP_PRIVACY_INVENTORY.md`
- `docs/app-store/APP_STORE_METADATA_DRAFT.md`
- `docs/app-store/TESTFLIGHT_TEST_PLAN.md`
- `docs/app-store/APP_REVIEW_NOTES_DRAFT.md`
- `docs/app-store/FINAL_IOS_RELEASE_REPORT.md` (questo file)
