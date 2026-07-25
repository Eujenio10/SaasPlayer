/**
 * Astrazione Rewarded Ads.
 * - Mock: EXPO_PUBLIC_ADS_FORCE_MOCK=1 (default in __DEV__ se non forzi AdMob)
 * - AdMob reale: EXPO_PUBLIC_ADS_FORCE_MOCK=0
 * - In __DEV__ usa sempre le sample unit Google (fill affidabile), salvo USE_PRODUCTION_UNITS=1
 */

import { Platform } from "react-native";

export interface RewardedAdShowResult {
  completed: boolean;
  rewarded: boolean;
  transactionId?: string;
  error?: string;
}

export interface RewardedAdsService {
  load(): Promise<void>;
  isReady(): boolean;
  show(options?: { customData?: string }): Promise<RewardedAdShowResult>;
}

/** Sample ufficiali Google — non usare TestIds.REWARDED (può essere "" prima del Platform.select). */
const GOOGLE_SAMPLE_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";
const GOOGLE_SAMPLE_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";

let mobileAdsInitialized: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureMobileAdsInitialized(mod: any): Promise<void> {
  if (!mobileAdsInitialized) {
    mobileAdsInitialized = (async () => {
      const api = typeof mod.default === "function" ? mod.default() : (mod.default ?? mod);
      if (typeof api?.setRequestConfiguration === "function") {
        await api.setRequestConfiguration({
          testDeviceIdentifiers: ["EMULATOR", "SIMULATOR"]
        });
      }
      if (typeof api?.initialize === "function") {
        await api.initialize();
      } else if (typeof mod.initialize === "function") {
        await mod.initialize();
      }
    })();
  }
  return mobileAdsInitialized;
}

function googleSampleUnit(): string {
  return Platform.OS === "ios" ? GOOGLE_SAMPLE_REWARDED_IOS : GOOGLE_SAMPLE_REWARDED_ANDROID;
}

function rewardedUnitId(): string {
  const useProductionUnits = process.env.EXPO_PUBLIC_ADMOB_USE_PRODUCTION_UNITS === "1";

  // Preview/dev: sample Google (fill affidabile). Production store: unit reali (USE_PRODUCTION_UNITS=1).
  if (!useProductionUnits) {
    return googleSampleUnit();
  }

  const envKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_IOS
      : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID;
  const configured = envKey?.trim() ?? "";

  if (!configured) {
    throw new Error(
      "EXPO_PUBLIC_ADMOB_REWARDED_UNIT_IOS/ANDROID mancante: configura unit reali prima della build production."
    );
  }
  if (configured === GOOGLE_SAMPLE_REWARDED_IOS || configured === GOOGLE_SAMPLE_REWARDED_ANDROID) {
    throw new Error("AdMob sample unit non consentita con USE_PRODUCTION_UNITS=1.");
  }
  return configured;
}

class MockRewardedAdsService implements RewardedAdsService {
  private ready = false;

  async load(): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async show(): Promise<RewardedAdShowResult> {
    if (!this.ready) await this.load();
    await new Promise((r) => setTimeout(r, 1200));
    return {
      completed: true,
      rewarded: true,
      transactionId: `dev_${Date.now()}`
    };
  }
}

class AdMobRewardedAdsService implements RewardedAdsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private module: any;
  private ready = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rewarded: any = null;

  constructor(mod: unknown) {
    this.module = mod;
  }

  async load(): Promise<void> {
    await ensureMobileAdsInitialized(this.module);
    this.ready = false;
    const { RewardedAd, RewardedAdEventType, AdEventType } = this.module;
    const unitId = rewardedUnitId();
    if (!unitId) {
      throw new Error("Ad unit ID vuoto: controlla la configurazione AdMob.");
    }

    this.rewarded = RewardedAd.createForAdRequest(unitId);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Timeout caricamento ads. In dev lascia EXPO_PUBLIC_ADMOB_USE_PRODUCTION_UNITS=0 e riavvia Metro con --clear."
          )
        );
      }, 25000);

      const unsubLoaded = this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timeout);
        this.ready = true;
        unsubLoaded();
        unsubError();
        resolve();
      });
      const unsubError = this.rewarded.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
        clearTimeout(timeout);
        unsubLoaded();
        unsubError();
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "ad_load_failed";
        reject(
          new Error(
            `${message} (unit=${unitId}). Se vedi "No ads to show", in test usa le sample Google (USE_PRODUCTION_UNITS=0).`
          )
        );
      });
      this.rewarded.load();
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  async show(options?: { customData?: string }): Promise<RewardedAdShowResult> {
    if (!this.ready || !this.rewarded) {
      await this.load();
    }
    void options?.customData;

    return new Promise((resolve) => {
      let rewarded = false;
      let settled = false;
      const { RewardedAdEventType, AdEventType } = this.module;

      const finish = (result: RewardedAdShowResult) => {
        if (settled) return;
        settled = true;
        this.ready = false;
        this.rewarded = null;
        resolve(result);
      };

      this.rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        rewarded = true;
      });
      this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        finish({
          completed: true,
          rewarded,
          transactionId: rewarded ? `admob_${Date.now()}` : undefined,
          error: rewarded ? undefined : "closed_before_reward"
        });
      });
      this.rewarded.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "ad_show_failed";
        finish({ completed: false, rewarded: false, error: message });
      });

      this.rewarded.show().catch((err: unknown) => {
        finish({
          completed: false,
          rewarded: false,
          error: err instanceof Error ? err.message : "ad_show_failed"
        });
      });
    });
  }
}

let singleton: RewardedAdsService | null = null;

function tryCreateAdMobService(): RewardedAdsService | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-google-mobile-ads");
    if (mod?.RewardedAd) return new AdMobRewardedAdsService(mod);
  } catch {
    // package non installato / native module assente
  }
  return null;
}

export function getRewardedAdsService(): RewardedAdsService {
  if (!singleton) {
    const forceMock = process.env.EXPO_PUBLIC_ADS_FORCE_MOCK === "1";
    const forceAdMob = process.env.EXPO_PUBLIC_ADS_FORCE_MOCK === "0";

    if (forceMock) {
      singleton = new MockRewardedAdsService();
    } else if (forceAdMob || !__DEV__) {
      singleton = tryCreateAdMobService() ?? new MockRewardedAdsService();
    } else {
      singleton = new MockRewardedAdsService();
    }
  }
  return singleton;
}

export function __setRewardedAdsServiceForTests(service: RewardedAdsService | null): void {
  singleton = service;
}
