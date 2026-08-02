/**
 * In-App Purchase App Store / Play Store via RevenueCat (react-native-purchases).
 * In Expo Go / senza pacchetto: mock controllato da EXPO_PUBLIC_IAP_FORCE_MOCK.
 */

import { Platform } from "react-native";

export type IapPurchaseResult =
  | { ok: true; active: boolean; expiresAt: string | null; productId?: string }
  | { ok: false; cancelled?: boolean; message: string };

export interface IapService {
  configure(userId: string): Promise<void>;
  getProProductPriceLabel(): Promise<string | null>;
  purchaseProMonthly(): Promise<IapPurchaseResult>;
  restore(): Promise<IapPurchaseResult>;
  hasProEntitlement(): Promise<boolean>;
}

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_PRO ?? "pro";
const OFFERING_ID = process.env.EXPO_PUBLIC_RC_OFFERING_ID ?? "default";
const PACKAGE_ID = process.env.EXPO_PUBLIC_RC_PACKAGE_PRO_MONTHLY ?? "$rc_monthly";

function apiKeyForPlatform(): string {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() ?? "";
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() ?? "";
}

class MockIapService implements IapService {
  private active = false;

  async configure(): Promise<void> {
    // no-op
  }

  async getProProductPriceLabel(): Promise<string | null> {
    return "€6,99/mese (mock)";
  }

  async purchaseProMonthly(): Promise<IapPurchaseResult> {
    this.active = true;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { ok: true, active: true, expiresAt, productId: "mock_pro_monthly" };
  }

  async restore(): Promise<IapPurchaseResult> {
    return {
      ok: true,
      active: this.active,
      expiresAt: this.active ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    };
  }

  async hasProEntitlement(): Promise<boolean> {
    return this.active;
  }
}

class RevenueCatIapService implements IapService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private Purchases: any;
  private configuredFor: string | null = null;

  constructor(mod: { default?: unknown } | unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMod = mod as any;
    this.Purchases = anyMod.default ?? anyMod;
  }

  async configure(userId: string): Promise<void> {
    const apiKey = apiKeyForPlatform();
    if (!apiKey) {
      throw new Error("revenuecat_api_key_missing");
    }
    if (this.configuredFor === userId) return;
    this.Purchases.configure({ apiKey, appUserID: userId });
    this.configuredFor = userId;
  }

  private async findMonthlyPackage() {
    const offerings = await this.Purchases.getOfferings();
    const offering =
      offerings.all?.[OFFERING_ID] ?? offerings.current ?? Object.values(offerings.all ?? {})[0];
    if (!offering) return null;
    const fromId = offering.availablePackages?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.identifier === PACKAGE_ID || p.packageType === "MONTHLY"
    );
    return fromId ?? offering.monthly ?? offering.availablePackages?.[0] ?? null;
  }

  async getProProductPriceLabel(): Promise<string | null> {
    const pkg = await this.findMonthlyPackage();
    const product = pkg?.product;
    if (!product) return null;
    return product.priceString ?? null;
  }

  async purchaseProMonthly(): Promise<IapPurchaseResult> {
    try {
      const pkg = await this.findMonthlyPackage();
      if (!pkg) {
        return { ok: false, message: "Prodotto Pro mensile non trovato nello store." };
      }
      const { customerInfo } = await this.Purchases.purchasePackage(pkg);
      const ent = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      const active = Boolean(ent);
      return {
        ok: true,
        active,
        expiresAt: ent?.expirationDate ?? null,
        productId: pkg.product?.identifier
      };
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (err?.userCancelled || err?.code === "1" || err?.code === "PURCHASE_CANCELLED") {
        return { ok: false, cancelled: true, message: "Acquisto annullato." };
      }
      const main = err?.message ? String(err.message) : "Acquisto non riuscito.";
      const underlying =
        err?.underlyingErrorMessage ??
        err?.userInfo?.underlyingErrorMessage ??
        err?.readableErrorCode ??
        err?.userInfo?.readable_error_code ??
        null;
      return {
        ok: false,
        message: underlying ? `${main} (${String(underlying)})` : main
      };
    }
  }

  async restore(): Promise<IapPurchaseResult> {
    try {
      const customerInfo = await this.Purchases.restorePurchases();
      const ent = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      return {
        ok: true,
        active: Boolean(ent),
        expiresAt: ent?.expirationDate ?? null
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Ripristino non riuscito."
      };
    }
  }

  async hasProEntitlement(): Promise<boolean> {
    try {
      const customerInfo = await this.Purchases.getCustomerInfo();
      return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
    } catch {
      return false;
    }
  }
}

let singleton: IapService | null = null;

function tryCreateRevenueCat(): IapService | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-purchases");
    if (mod) return new RevenueCatIapService(mod);
  } catch {
    // pacchetto non installato
  }
  return null;
}

export function getIapService(): IapService {
  if (singleton) return singleton;

  const forceMock =
    process.env.EXPO_PUBLIC_IAP_FORCE_MOCK === "1" ||
    (__DEV__ && process.env.EXPO_PUBLIC_IAP_FORCE_MOCK !== "0");

  if (forceMock) {
    singleton = new MockIapService();
    return singleton;
  }

  singleton = tryCreateRevenueCat();
  if (!singleton) {
    singleton = new MockIapService();
  }
  return singleton;
}

export function isIapUsingMock(): boolean {
  const svc = getIapService();
  return svc instanceof MockIapService;
}

export function __setIapServiceForTests(service: IapService | null): void {
  singleton = service;
}
