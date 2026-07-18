import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "expo-router";
import type { FeatureId, PendingAction } from "@/lib/access/types";
import { canAccessFeatureId } from "@/lib/access/features";
import { useAuth } from "@/contexts/AuthContext";

interface AccessFlowContextValue {
  paywallVisible: boolean;
  paywallFeature: FeatureId | null;
  pendingAction: PendingAction | null;
  restoreMessage: string | null;
  purchaseMessage: string | null;
  requestFeature: (feature: FeatureId, pending?: PendingAction) => boolean;
  openPaywall: (feature: FeatureId, pending?: PendingAction) => void;
  closePaywall: () => void;
  continueAsGuest: () => void;
  openAuthFromPaywall: () => void;
  handleRestorePurchases: () => Promise<void>;
  handleActivatePro: () => Promise<void>;
  clearMessages: () => void;
  resumePendingAction: () => void;
}

const AccessFlowContext = createContext<AccessFlowContextValue | null>(null);

export function AccessFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { userStatus, session, restorePurchases, activateProPurchase } = useAuth();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<FeatureId | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

  const openPaywall = useCallback((feature: FeatureId, pending?: PendingAction) => {
    setPaywallFeature(feature);
    setPendingAction(
      pending ?? { type: "open_feature", feature }
    );
    setPaywallVisible(true);
    setRestoreMessage(null);
    setPurchaseMessage(null);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallFeature(null);
    setPendingAction(null);
  }, []);

  const continueAsGuest = useCallback(() => {
    closePaywall();
  }, [closePaywall]);

  const requestFeature = useCallback(
    (feature: FeatureId, pending?: PendingAction) => {
      if (canAccessFeatureId(userStatus, feature)) return true;
      openPaywall(feature, pending);
      return false;
    },
    [openPaywall, userStatus]
  );

  const openAuthFromPaywall = useCallback(() => {
    setPaywallVisible(false);
    router.push("/login");
  }, [router]);

  const handleRestorePurchases = useCallback(async () => {
    setRestoreMessage(null);
    if (!session) {
      setPendingAction((prev) => prev ?? { type: "restore_purchases" });
      router.push("/login");
      return;
    }
    const result = await restorePurchases();
    setRestoreMessage(
      result.restored
        ? "Piano Pro ripristinato correttamente."
        : "Nessun Piano Pro attivo trovato."
    );
    if (result.restored) closePaywall();
  }, [closePaywall, restorePurchases, router, session]);

  const handleActivatePro = useCallback(async () => {
    setPurchaseMessage(null);
    if (!session) {
      openAuthFromPaywall();
      return;
    }
    const result = await activateProPurchase();
    setPurchaseMessage(result.message);
    if (result.completed) closePaywall();
  }, [activateProPurchase, closePaywall, openAuthFromPaywall, session]);

  const resumePendingAction = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "restore_purchases") {
      void handleRestorePurchases();
      return;
    }
    if (pendingAction.type === "open_feature") {
      if (canAccessFeatureId(userStatus, pendingAction.feature)) {
        closePaywall();
        return;
      }
      setPaywallFeature(pendingAction.feature);
      setPaywallVisible(true);
      return;
    }
    if (pendingAction.type === "activate_pro") {
      setPaywallVisible(true);
    }
  }, [closePaywall, handleRestorePurchases, pendingAction, userStatus]);

  const clearMessages = useCallback(() => {
    setRestoreMessage(null);
    setPurchaseMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      paywallVisible,
      paywallFeature,
      pendingAction,
      restoreMessage,
      purchaseMessage,
      requestFeature,
      openPaywall,
      closePaywall,
      continueAsGuest,
      openAuthFromPaywall,
      handleRestorePurchases,
      handleActivatePro,
      clearMessages,
      resumePendingAction
    }),
    [
      paywallVisible,
      paywallFeature,
      pendingAction,
      restoreMessage,
      purchaseMessage,
      requestFeature,
      openPaywall,
      closePaywall,
      continueAsGuest,
      openAuthFromPaywall,
      handleRestorePurchases,
      handleActivatePro,
      clearMessages,
      resumePendingAction
    ]
  );

  return <AccessFlowContext.Provider value={value}>{children}</AccessFlowContext.Provider>;
}

export function useAccessFlow() {
  const ctx = useContext(AccessFlowContext);
  if (!ctx) throw new Error("useAccessFlow deve essere usato dentro AccessFlowProvider");
  return ctx;
}
