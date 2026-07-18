/**
 * Astrazione Rewarded Ads.
 * - Dev / senza SDK: mock che completa la reward
 * - Con react-native-google-mobile-ads installato (dev client): AdMob reale
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

const UNIT_IOS =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_IOS ?? "ca-app-pub-3940256099942544/1712485313";
const UNIT_ANDROID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ANDROID ?? "ca-app-pub-3940256099942544/5224354917";

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

  private unitId(): string {
    return Platform.OS === "ios" ? UNIT_IOS : UNIT_ANDROID;
  }

  async load(): Promise<void> {
    const { RewardedAd, RewardedAdEventType, AdEventType } = this.module;
    this.rewarded = RewardedAd.createForAdRequest(this.unitId(), {
      requestNonPersonalizedAdsOnly: true
    });

    await new Promise<void>((resolve, reject) => {
      const unsubLoaded = this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.ready = true;
        unsubLoaded();
        resolve();
      });
      const unsubError = this.rewarded.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
        unsubError();
        reject(err instanceof Error ? err : new Error("ad_load_failed"));
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
      let completed = false;
      const { RewardedAdEventType, AdEventType } = this.module;

      const finish = (result: RewardedAdShowResult) => {
        resolve(result);
      };

      this.rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        rewarded = true;
      });
      this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        completed = true;
        finish({
          completed,
          rewarded,
          transactionId: rewarded ? `admob_${Date.now()}` : undefined,
          error: rewarded ? undefined : "closed_before_reward"
        });
      });
      this.rewarded.addAdEventListener(AdEventType.ERROR, () => {
        finish({ completed: false, rewarded: false, error: "ad_show_failed" });
      });

      this.rewarded.show().catch(() => {
        finish({ completed: false, rewarded: false, error: "ad_show_failed" });
      });
    });
  }
}

let singleton: RewardedAdsService | null = null;

function tryCreateAdMobService(): RewardedAdsService | null {
  try {
    // Optional dependency — install with: npx expo install react-native-google-mobile-ads
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-google-mobile-ads");
    if (mod?.RewardedAd) return new AdMobRewardedAdsService(mod);
  } catch {
    // package non installato
  }
  return null;
}

export function getRewardedAdsService(): RewardedAdsService {
  if (!singleton) {
    const forceMock = process.env.EXPO_PUBLIC_ADS_FORCE_MOCK === "1" || __DEV__;
    if (!forceMock) {
      singleton = tryCreateAdMobService() ?? new MockRewardedAdsService();
    } else {
      // In __DEV__ usa mock di default; set EXPO_PUBLIC_ADS_FORCE_MOCK=0 per testare AdMob
      const preferAdMob = process.env.EXPO_PUBLIC_ADS_FORCE_MOCK === "0";
      singleton = preferAdMob
        ? tryCreateAdMobService() ?? new MockRewardedAdsService()
        : new MockRewardedAdsService();
    }
  }
  return singleton;
}

export function __setRewardedAdsServiceForTests(service: RewardedAdsService | null): void {
  singleton = service;
}
