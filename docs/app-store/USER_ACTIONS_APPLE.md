# Azioni utente — Apple / Expo / Store

Ordine cronologico. Checkbox da spuntare man mano.

## 0. Conferme immediate

- [ ] **Confermare Bundle Identifier** `com.ildodicesimo.tacticalhub` come definitivo  
  - Dove: decisione tua + coerenza App Store Connect  
  - Se cambi: aggiornare `mobile/app.json` prima di qualsiasi build  
  - Blocca: build e submit

- [ ] **Login Expo/EAS** (personale, non in chat)  
  - Comando (nella cartella `mobile`):  
    `npx eas-cli@latest login`  
  - Verifica: `npx eas-cli@latest whoami` mostra il tuo account  
  - Blocca: build EAS

- [ ] **Collegare progetto EAS**  
  - Comando: `npx eas-cli@latest init` (o `eas project:info`)  
  - Verifica: `app.json` / `app.config` riceve `extra.eas.projectId` reale  
  - Blocca: build

## 1. Apple Developer / App Store Connect

- [ ] Apple Developer Program attivo (hai detto già iscritto) — verifica contratto Paid Apps  
- [ ] Accettare contratti App Store Connect  
- [ ] Creare app iOS in App Store Connect  
  - Bundle ID: stesso di `app.json`  
  - SKU: a tua scelta (es. `pitchbrain-ios-001`)  
  - Lingua primaria: Italiano  
- [ ] Comunicare **App Store Connect App ID numerico** (non inventabile)  
  - Serve per submit EAS opzionale (`ascAppId`)  
  - Blocca: solo submit automatico, non la build

## 2. Abbonamento Pro (IAP)

- [ ] Creare Subscription Group (es. `PitchBrain Pro`)  
- [ ] Creare prodotto mensile (es. product id `pro_monthly`)  
- [ ] Prezzo, localizzazioni, review screenshot IAP  
- [ ] Sandbox testers Apple  
- Blocca: review se vendi Pro in-app senza prodotti configurati

## 3. RevenueCat

- [ ] Progetto RevenueCat + app iOS collegata  
- [ ] Entitlement `pro`, offering `default`, package mensile  
- [ ] API key iOS `appl_…`  
- [ ] Webhook → `https://saas-player.vercel.app/api/subscriptions/revenuecat`  
  - Header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`  
- [ ] Impostare secret su Vercel Production e redeploy  
- Blocca: Pro reale in production

## 4. AdMob iOS

- [ ] App AdMob iOS + App ID  
- [ ] Rewarded Ad Unit iOS  
- [ ] SSV callback → `https://saas-player.vercel.app/api/ads/admob-ssv`  
- [ ] Fornire unit id (non sample Google) per EAS env  
- Blocca: ads reali in production

## 5. Privacy / legale / metadata

- [ ] Confermare URL privacy pubblica (candidate: `https://saas-player.vercel.app/legal/privacy`)  
- [ ] URL supporto / marketing  
- [ ] Compilare App Privacy in App Store Connect usando `APP_PRIVACY_INVENTORY.md`  
- [ ] Age rating  
- [ ] Export compliance (vedi nota tecnica in audit: HTTPS standard → tipicamente exempt; conferma legale)  
- [ ] Screenshot iPhone richiesti  
- [ ] Descrizione / keywords (bozza in `APP_STORE_METADATA_DRAFT.md`)  
- [ ] Account demo App Review (email+password utente Free e se possibile flusso Pro Sandbox)

## 6. Env EAS (Production / Preview)

Impostare su Expo (Secrets / env) **senza** incollare valori in chat:

- [ ] `EXPO_PUBLIC_SUPABASE_URL`  
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`  
- [ ] `EXPO_PUBLIC_API_URL=https://saas-player.vercel.app`  
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`  
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` (Google Play — vedi `USER_ACTIONS_GOOGLE.md`)  
- [ ] `EXPO_PUBLIC_RC_ENTITLEMENT_PRO=PitchBrain Pro` (deve coincidere con RevenueCat)  
- [ ] `EXPO_PUBLIC_RC_OFFERING_ID=default`  
- [ ] `EXPO_PUBLIC_RC_PACKAGE_PRO_MONTHLY` (allineato a RC)  
- [ ] `EXPO_PUBLIC_IAP_FORCE_MOCK=0`  
- [ ] `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_IOS`  
- [ ] `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID`  
- [ ] `EXPO_PUBLIC_ADS_FORCE_MOCK=0`  
- Blocca: build production utile

**Android / Play Store:** checklist completa in [`USER_ACTIONS_GOOGLE.md`](./USER_ACTIONS_GOOGLE.md).

## 7. Dopo che Cursor avrà installato i pacchetti nativi IAP/AdMob

- [ ] Autorizare EAS a gestire certificati iOS (prompt interattivo al primo build)  
- [ ] Registrare iPhone di test (UDID) se serve development/ad-hoc  
- [ ] Eseguire development o preview build  
- [ ] TestFlight internal  
- [ ] Selezionare build → Invia a App Review  

## Comandi che eseguirai tu (quando i prerequisiti sono ok)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile development
# poi, solo se audit verde:
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production --latest
```
