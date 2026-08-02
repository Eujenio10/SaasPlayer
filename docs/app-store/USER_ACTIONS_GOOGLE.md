# Azioni utente — Google Play / Android IAP

Checklist per abilitare **PitchBrain Pro** via Google Play Billing + RevenueCat.  
Il codice mobile è già pronto: stesso flusso di iOS (`ProPaywallModal` → RevenueCat → `iap-sync` → webhook).

**Package Android:** `com.ildodicesimo.tacticalhub` (come in `mobile/app.json`)

---

## 0. Prerequisiti

- [ ] Account **Google Play Console** attivo (25 $ una tantum)
- [ ] App Play creata (PitchBrain, package sopra)
- [ ] RevenueCat con app **iOS già configurata** (stesso progetto)
- [ ] Webhook Vercel già attivo: `https://saas-player.vercel.app/api/subscriptions/revenuecat`
- [ ] Login EAS: `npx eas-cli@latest login` (cartella `mobile`)

> **Nota Play Console:** spesso non puoi creare abbonamenti finché non carichi almeno un **AAB** (build EAS preview/production). Se la sezione Abbonamenti è bloccata, salta al §5 (prima build), poi torna al §2.

---

## 1. Google Play Console — app e merchant

- [ ] Completa **Dashboard** → setup base (privacy policy URL, categorie, content rating)
- [ ] **Monetizzazione** → attiva profilo commerciante / pagamenti (se richiesto)
- [ ] **Impostazioni** → **Accesso app** → aggiungi la tua email come **License tester** (per acquisti di prova)

---

## 2. Abbonamento Pro (Play Billing)

- [ ] **Monetizzazione** → **Prodotti** → **Abbonamenti** → **Crea abbonamento**
- [ ] **Product ID:** `pitchbrain_pro_monthly` (allineato ad Apple se possibile)
- [ ] Base plan **mensile** + prezzo (es. €4,99 — stesso di iOS)
- [ ] Localizzazione IT (nome + descrizione)
- [ ] Stato: **Attivo** (dopo aver caricato almeno una build in test interno)

Annota:
- Product ID Android: `pitchbrain_pro_monthly`
- Base plan ID (es. `monthly-default`)

---

## 3. RevenueCat — app Android

### 3.1 Aggiungi app Android

- [ ] RevenueCat → **Project settings** → **Apps** → **+ New**
- [ ] Platform: **Google Play Store**
- [ ] Package name: `com.ildodicesimo.tacticalhub`
- [ ] Copia **Public API Key Android** (`goog_…`)

### 3.2 Service credentials (Google ↔ RevenueCat)

RevenueCat deve validare gli acquisti Play:

1. [Google Cloud Console](https://console.cloud.google.com) → stesso progetto collegato a Play Console  
2. **IAM & Admin** → **Service Accounts** → crea account (es. `revenuecat-play`)  
3. Ruolo minimo: accesso API Play (RevenueCat doc: *Pub/Sub* o *Financial* a seconda della versione — segui il wizard RevenueCat **Apps → Android → Service credentials**)  
4. Crea **JSON key** → scarica (non committare in git)  
5. In RevenueCat → app Android → **Service credentials** → carica il JSON  

- [ ] Service account collegato in RevenueCat (stato verde / connected)

### 3.3 Product catalog (stesso entitlement di iOS)

- [ ] **Products** → sezione **PitchBrain (Play Store)** → **+ New**  
  - Identifier: `pitchbrain_pro_monthly` (identico a Play Console)  
  - Type: Subscription  
- [ ] **Entitlements** → apri `PitchBrain Pro` (o `pro`) → **Attach** anche il product Play Store  
- [ ] **Offerings** → `default` → package mensile (`$rc_monthly`) → deve includere **sia** product App Store **sia** Play Store (RevenueCat mostra entrambi sullo stesso package)

Allinea l’entitlement con EAS:

```env
EXPO_PUBLIC_RC_ENTITLEMENT_PRO=PitchBrain Pro
```

(o rinomina l’identifier in RC a `pro` e usa `pro` ovunque)

---

## 4. Segreti EAS (Android)

Imposta su [expo.dev](https://expo.dev) → progetto → **Secrets** (non incollare in chat):

- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_…`
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_…` (già presente)
- [ ] `EXPO_PUBLIC_RC_ENTITLEMENT_PRO=PitchBrain Pro`
- [ ] `EXPO_PUBLIC_RC_OFFERING_ID=default`
- [ ] `EXPO_PUBLIC_RC_PACKAGE_PRO_MONTHLY=$rc_monthly`
- [ ] `EXPO_PUBLIC_IAP_FORCE_MOCK=0`
- [ ] `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID=ca-app-pub-…/…`
- [ ] `EXPO_PUBLIC_ADS_FORCE_MOCK=0`

Vercel (backend, già condiviso con iOS):

- [ ] `REVENUECAT_WEBHOOK_SECRET` — stesso webhook per iOS e Android

---

## 5. Build e upload Play (test interno)

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
# oppure production:
npx eas-cli@latest build --platform android --profile production
```

- [ ] Scarica / installa l’APK (preview) o carica l’AAB su Play **Testing → Internal testing**
- [ ] Aggiungi tester interni (email Google)
- [ ] Se l’abbonamento era in bozza: torna al §2 e **attivalo**

### Submit automatico (opzionale)

1. Play Console → **Setup → API access** → collega Google Cloud  
2. Crea service account per **upload** (può essere diverso da RevenueCat)  
3. Salva JSON come `mobile/google-play-service-account.json` (già in `.gitignore`)  
4. `eas.json` punta già a quel path  

```bash
npx eas-cli@latest submit --platform android --profile production --latest
```

---

## 6. Test acquisto Android

Su dispositivo con build EAS (non Expo Go):

1. [ ] Login con account **License tester** (stesso Google account del telefono o aggiunto in Play Console)  
2. [ ] Registrati / accedi in PitchBrain  
3. [ ] Apri paywall Pro → **Attiva Pro**  
4. [ ] Completa il flusso Google Play (sandbox / test — nessun addebito reale per license testers)  
5. [ ] Verifica messaggio “PitchBrain Pro attivo”  
6. [ ] **Ripristina acquisti** dopo reinstall  
7. [ ] RevenueCat → **Customers** → utente = Supabase `user.id` → entitlement attivo  
8. [ ] Vercel logs → `POST /api/subscriptions/revenuecat` → 200  
9. [ ] Backend → utente con Pro (report illimitati, ecc.)

---

## 7. Cosa fa già il codice (non serve modificare)

| Pezzo | File |
|-------|------|
| API key Android | `mobile/lib/subscription/iap.ts` → `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` |
| Provider sync | `play_store` in `mobile/lib/subscription/entitlements.ts` |
| Backend sync | `app/api/mobile/user/subscriptions/iap-sync/route.ts` |
| Webhook | `app/api/subscriptions/revenuecat/route.ts` (iOS + Android) |
| Permesso billing | `com.android.vending.BILLING` in `mobile/app.json` |

---

## 8. Troubleshooting

| Problema | Causa probabile | Azione |
|----------|-----------------|--------|
| “Prodotto Pro non trovato” | Offering RC vuota o product Play non attachato | §3.3, attendi propagazione 1–2 h |
| `revenuecat_api_key_missing` | Secret EAS Android mancante | §4 + rebuild |
| Pagamento ok, Pro non attivo | Webhook o `iap-sync` fallito | Log Vercel, Ripristina acquisti |
| “Item unavailable” | Abbonamento non attivo su Play o build non firmata con stesso package | §2 + §5 |
| Offerings solo iOS | Package `default` senza product Play | RC → Offerings → edit package |
| “There was a credential issue…” / `InvalidCredentialsError` (code 11) | Service credentials Google↔RevenueCat (§3.2) mancanti, sbagliate, senza permessi corretti, non ancora propagate (fino a 36h), o abbonamento senza **prezzo attivo** in Play Console | Rifai §3.2, controlla permessi service account (View financial data + Manage orders and subscriptions), verifica prezzo attivo su Play Console §2, attendi fino a 36h |

---

## Comandi rapidi

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production --latest
```

Dopo Android ok: ripeti checklist metadata Play (screenshot, privacy, content rating) in parallelo a iOS (`APP_STORE_METADATA_DRAFT.md` come base testi).
