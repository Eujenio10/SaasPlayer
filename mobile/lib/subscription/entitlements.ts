import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { fetchUserAccess } from "@/lib/api";
import { fetchUserEntitlements } from "@/lib/entitlements/api";
import type { SubscriptionEntitlement } from "@/lib/access/types";
import { trackMobileEntitlementEvent } from "@/lib/entitlements/analytics";
import { getIapService, isIapUsingMock } from "@/lib/subscription/iap";
import { syncIapProSubscription } from "@/lib/subscription/iap-api";

const SUBSCRIPTION_KEY_PREFIX = "pitchbrain_subscription_state:";

async function readStoredSubscriptionState(userId: string): Promise<"none" | "expired" | null> {
  try {
    const raw = await SecureStore.getItemAsync(`${SUBSCRIPTION_KEY_PREFIX}${userId}`);
    if (raw === "expired") return "expired";
    return null;
  } catch {
    return null;
  }
}

/**
 * Legge Pro da: ruolo backend, abbonamento IAP sincronizzato, override locale.
 */
export async function refreshUserEntitlements(userId: string): Promise<SubscriptionEntitlement> {
  try {
    const iap = getIapService();
    await iap.configure(userId).catch(() => undefined);

    const [access, entitlements, iapActive] = await Promise.all([
      fetchUserAccess().catch(() => null),
      fetchUserEntitlements().catch(() => null),
      iap.hasProEntitlement().catch(() => false)
    ]);

    if (access?.isPro || access?.isAdmin || entitlements?.subscriptionTier === "pro" || iapActive) {
      await SecureStore.deleteItemAsync(`${SUBSCRIPTION_KEY_PREFIX}${userId}`).catch(() => undefined);
      return { state: "active", renewsAt: null };
    }

    const stored = await readStoredSubscriptionState(userId);
    if (stored === "expired") {
      return { state: "expired", renewsAt: null };
    }
    return { state: "none", renewsAt: null };
  } catch {
    return { state: "none", renewsAt: null };
  }
}

export async function markSubscriptionExpired(userId: string): Promise<void> {
  await SecureStore.setItemAsync(`${SUBSCRIPTION_KEY_PREFIX}${userId}`, "expired");
}

export async function clearSubscriptionOverride(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${SUBSCRIPTION_KEY_PREFIX}${userId}`);
}

export async function restorePurchases(userId: string): Promise<{
  restored: boolean;
  entitlement: SubscriptionEntitlement;
}> {
  const iap = getIapService();
  await iap.configure(userId);
  const restored = await iap.restore();

  if (restored.ok && restored.active) {
    const sync = await syncIapProSubscription({
      active: true,
      expiresAt: restored.expiresAt,
      productId: restored.productId,
      provider: Platform.OS === "ios" ? "app_store" : "play_store"
    });
    if (!sync.ok) {
      const entitlement = await refreshUserEntitlements(userId);
      return { restored: entitlement.state === "active", entitlement };
    }
  }

  const entitlement = await refreshUserEntitlements(userId);
  return { restored: entitlement.state === "active", entitlement };
}

/**
 * Acquisto Pro mensile tramite App Store / Google Play (RevenueCat).
 * Richiede account registrato. Alla scadenza store/webhook → Free.
 */
export async function startProPurchase(userId: string): Promise<{
  completed: boolean;
  message: string;
}> {
  void trackMobileEntitlementEvent("pro_subscription_started", {
    subscriptionTier: "free",
    featureKey: "iap"
  });

  try {
    const iap = getIapService();
    await iap.configure(userId);

    if (isIapUsingMock() && !__DEV__) {
      return {
        completed: false,
        message:
          "Pagamenti store non configurati. Installa react-native-purchases e crea un build EAS (non Expo Go)."
      };
    }

    const result = await iap.purchaseProMonthly();
    if (!result.ok) {
      return {
        completed: false,
        message: result.cancelled ? "Acquisto annullato." : result.message
      };
    }

    if (!result.active) {
      return {
        completed: false,
        message: "Pagamento non confermato dallo store. Riprova o usa Ripristina acquisti."
      };
    }

    const sync = await syncIapProSubscription({
      active: true,
      expiresAt: result.expiresAt,
      productId: result.productId,
      provider: isIapUsingMock()
        ? "mock"
        : Platform.OS === "ios"
          ? "app_store"
          : "play_store"
    });

    if (!sync.ok) {
      return {
        completed: false,
        message:
          "Pagamento ricevuto ma attivazione non completata. Attendi qualche secondo e usa Ripristina acquisti."
      };
    }

    void trackMobileEntitlementEvent("pro_subscription_completed", {
      subscriptionTier: "pro",
      featureKey: "iap"
    });

    return {
      completed: true,
      message: isIapUsingMock()
        ? "Pro attivato in modalità test (mock IAP)."
        : "PitchBrain Pro attivo. L'abbonamento si rinnova ogni mese dallo store."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "iap_failed";
    if (message === "revenuecat_api_key_missing") {
      return {
        completed: false,
        message:
          "Chiavi RevenueCat mancanti. Imposta EXPO_PUBLIC_REVENUECAT_API_KEY_IOS / ANDROID."
      };
    }
    return {
      completed: false,
      message: "Impossibile completare l'acquisto. Riprova più tardi."
    };
  }
}
