# PitchBrain — iOS Release Audit

**Data audit:** 2026-07-19  
**Branch:** `chore/ios-app-store-release`  
**Stato complessivo:** **NON PRONTO** per build production (mancano login EAS, IAP/AdMob nativi installati, prodotti App Store Connect, env production EAS).

## Configurazione corrente

| Voce | Valore |
|------|--------|
| Package manager | **npm** (`mobile/package-lock.json`) |
| Expo SDK | **54.0.36** (patch aggiornato in questo branch) |
| React Native | **0.81.5** |
| React | **19.1.0** |
| Node richiesto | `>=20` (verificato locale: v22.23.1) |
| Architettura | **Expo managed + Continuous Native Generation** (nessuna cartella `ios/` / `android/` versionata) |
| App name | PitchBrain |
| Slug | `tactical-intelligence-hub` |
| Version | `1.0.0` |
| Bundle ID iOS | `com.ildodicesimo.tacticalhub` (già presente in repo; da confermare come definitivo) |
| Scheme | `tactical-hub` |
| Backend prod | `https://saas-player.vercel.app` |

## Expo Doctor

```text
Comando: npx expo-doctor
Risultato: 18/18 checks passed. No issues detected!
```

### Prima delle correzioni (storico)

| Check | Esito | Correzione |
|-------|-------|------------|
| Icone `.png` con content JPEG | FAIL | Re-encode PNG reale (magic `89 50 4E 47`) |
| `expo@54.0.35` vs expected `~54.0.36` | FAIL | `npx expo install expo@~54.0.36` |

## Dipendenze native / Expo Go

| Libreria | In package.json | Uso nel codice | Expo Go | Serve dev/prod build |
|----------|-----------------|----------------|---------|----------------------|
| `expo-secure-store` | sì | sessione Supabase | sì | no |
| `expo-router` / linking | sì | navigazione + scheme | sì | no |
| `expo-dev-client` | sì (installato ora) | development build | n/a | sì |
| `react-native-purchases` | **no** | `mobile/lib/subscription/iap.ts` (require opzionale) | mock | **sì** |
| `react-native-google-mobile-ads` | **no** | `mobile/lib/ads/rewarded-ads.ts` (require opzionale) | mock | **sì** |
| Push / ATT / camera / location | no | non usate | — | — |
| Sign in with Apple / Google | no | solo email/password Supabase | — | — |

## Funzionalità prodotto rilevanti App Review

| Area | Stato |
|------|-------|
| Account (signup/login) | Presente (`mobile/app/login.tsx`) |
| Eliminazione account | **Implementata in questo branch** (`/api/user/delete-account` + UI Profilo) — da verificare su backend deployato |
| Pro / IAP | RevenueCat previsto; mock in Expo Go; pacchetto nativo **non installato** |
| Restore purchases | UI presente |
| Stripe in-app | Non usato su mobile (solo sync IAP → backend) |
| Rewarded ads | Mock in Go; AdMob opzionale; sample unit bloccate in production |
| Tracking / ATT | Non implementato (AdMob richiesto con `requestNonPersonalizedAdsOnly: true`) |
| Betting/gambling UI | Mobile: copy esplicitamente anti-betting; backend ha OddsAPI player props (non esposto in mobile UI) |
| Bankroll module | Solo schema SQL backend; **non** nell’app mobile |

## Problemi aperti (bloccanti build/submit)

1. `npx eas-cli whoami` → **Not logged in**
2. Progetto EAS non collegato (`eas init` non eseguito)
3. `react-native-purchases` e `react-native-google-mobile-ads` non installati
4. Env EAS production mancanti (RevenueCat, AdMob unit reali)
5. Record App Store Connect da creare / da fornire
6. Prodotti subscription App Store Connect da creare
7. Privacy policy URL pubblico da confermare (candidate: `https://saas-player.vercel.app/legal/privacy`)
8. `mobile` `tsc` fallisce per path `@/*` che risolve anche `../*` (parent monorepo) — non blocca Metro ma va sanato prima di CI typecheck

## Livello preparazione build

| Criterio | OK? |
|----------|-----|
| Expo Doctor clean | sì |
| Bundle ID presente | sì (da confermare) |
| Icone PNG valide | sì |
| Splash configurata | sì |
| `eas.json` | sì (creato) |
| EAS login + project link | **no** |
| Native IAP/AdMob packages | **no** |
| Env production EAS | **no** |
| Account deletion | codice sì / deploy da verificare |

**Verdict:** pronto per *continuare la preparazione*, **non** per lanciare `eas build --profile production`.
