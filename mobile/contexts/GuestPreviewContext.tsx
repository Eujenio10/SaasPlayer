import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { Alert } from "react-native";
import {
  activateGuestAdPreview,
  GUEST_FEATURES_UNLOCK_MESSAGE,
  GUEST_FEATURES_UNLOCK_TITLE,
  readGuestFeaturesPreviewExpiresAt,
  type GuestAdPreviewScope
} from "@/lib/guest-ad-preview";
import { useAuth } from "@/contexts/AuthContext";

interface GuestPreviewContextValue {
  /** Simulatore match + Duelli da monitorare (15 min dopo ADS). */
  featuresPreviewActive: boolean;
  featuresPreviewExpiresAt: number | null;
  adModalVisible: boolean;
  adWatching: boolean;
  openAdModal: (scope?: GuestAdPreviewScope) => void;
  closeAdModal: () => void;
  completeAdWatch: () => Promise<void>;
  /** @deprecated Usare featuresPreviewActive */
  previewActive: boolean;
  /** @deprecated Usare featuresPreviewActive */
  simulatorPreviewActive: boolean;
}

const GuestPreviewContext = createContext<GuestPreviewContextValue | null>(null);

export function GuestPreviewProvider({ children }: { children: ReactNode }) {
  const { userStatus } = useAuth();
  const [featuresPreviewActive, setFeaturesPreviewActive] = useState(false);
  const [featuresPreviewExpiresAt, setFeaturesPreviewExpiresAt] = useState<number | null>(null);
  const [adModalVisible, setAdModalVisible] = useState(false);
  const [adWatching, setAdWatching] = useState(false);

  const refreshPreviewState = useCallback(async () => {
    if (userStatus !== "guest") {
      setFeaturesPreviewActive(false);
      setFeaturesPreviewExpiresAt(null);
      return;
    }
    const expiresAt = await readGuestFeaturesPreviewExpiresAt();
    setFeaturesPreviewExpiresAt(expiresAt);
    setFeaturesPreviewActive(expiresAt != null);
  }, [userStatus]);

  useEffect(() => {
    void refreshPreviewState();
  }, [refreshPreviewState]);

  useEffect(() => {
    if (userStatus !== "guest" || !featuresPreviewExpiresAt) return;
    const delay = Math.max(0, featuresPreviewExpiresAt - Date.now()) + 250;
    const timer = setTimeout(() => {
      void refreshPreviewState();
    }, delay);
    return () => clearTimeout(timer);
  }, [featuresPreviewExpiresAt, refreshPreviewState, userStatus]);

  const openAdModal = useCallback((_scope: GuestAdPreviewScope = "features") => {
    setAdModalVisible(true);
  }, []);

  const closeAdModal = useCallback(() => {
    if (adWatching) return;
    setAdModalVisible(false);
  }, [adWatching]);

  const completeAdWatch = useCallback(async () => {
    setAdWatching(true);
    try {
      // TODO: collegare AdMob / Unity Ads / provider reale qui.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const expiresAt = await activateGuestAdPreview("features");
      setFeaturesPreviewExpiresAt(expiresAt);
      setFeaturesPreviewActive(true);
      setAdModalVisible(false);
      Alert.alert(GUEST_FEATURES_UNLOCK_TITLE, GUEST_FEATURES_UNLOCK_MESSAGE, [{ text: "Ho capito" }]);
    } finally {
      setAdWatching(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      featuresPreviewActive: userStatus === "guest" ? featuresPreviewActive : false,
      featuresPreviewExpiresAt: userStatus === "guest" ? featuresPreviewExpiresAt : null,
      previewActive: userStatus === "guest" ? featuresPreviewActive : false,
      simulatorPreviewActive: userStatus === "guest" ? featuresPreviewActive : true,
      adModalVisible,
      adWatching,
      openAdModal,
      closeAdModal,
      completeAdWatch
    }),
    [
      adModalVisible,
      adWatching,
      closeAdModal,
      completeAdWatch,
      featuresPreviewActive,
      featuresPreviewExpiresAt,
      openAdModal,
      userStatus
    ]
  );

  return <GuestPreviewContext.Provider value={value}>{children}</GuestPreviewContext.Provider>;
}

export function useGuestPreview() {
  const ctx = useContext(GuestPreviewContext);
  if (!ctx) throw new Error("useGuestPreview deve essere usato dentro GuestPreviewProvider");
  return ctx;
}

export type { GuestAdPreviewScope };
