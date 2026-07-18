import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { getRewardedAdsService } from "@/lib/ads/rewarded-ads";
import { fetchUserEntitlements, postUnlockMatchWithRewardedAd } from "@/lib/entitlements/api";
import type { EntitlementFeatureKey, UserEntitlements } from "@/lib/entitlements-types";
import { trackMobileEntitlementEvent } from "@/lib/entitlements/analytics";

const emptyEntitlements = (): UserEntitlements => ({
  userId: null,
  subscriptionTier: "free",
  rewardedUnlocksUsedToday: 0,
  rewardedUnlocksDate: "",
  rewardedUnlocksRemaining: 2,
  dailyRewardedUnlockLimit: 2,
  unlockedMatches: [],
  rewardedAdsEnabled: true
});

interface EntitlementsContextValue {
  entitlements: UserEntitlements;
  loading: boolean;
  unlocking: boolean;
  isPro: boolean;
  remainingUnlocks: number;
  refreshEntitlements: () => Promise<void>;
  isMatchUnlocked: (matchId: string | number) => boolean;
  canAccessFeature: (featureKey: EntitlementFeatureKey, matchId?: string | number) => boolean;
  canUnlockWithRewardedAd: (featureKey: EntitlementFeatureKey) => boolean;
  unlockMatchWithRewardedAd: (matchId: number, sourceScreen?: string) => Promise<boolean>;
  getRemainingRewardedUnlocks: () => number;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

const MATCH_UNLOCKABLE = new Set<EntitlementFeatureKey>([
  "match_full_analysis",
  "simulation_full"
]);

const PRO_ONLY = new Set<EntitlementFeatureKey>([
  "difficult_markings_full",
  "trends_full",
  "trends_filters",
  "player_compare",
  "favorites",
  "saved_analyses",
  "custom_alerts",
  "simulation_customize",
  "export_share",
  "all_competitions",
  "ad_free"
]);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { session, userStatus } = useAuth();
  const { openPaywall } = useAccessFlow();
  const [entitlements, setEntitlements] = useState<UserEntitlements>(emptyEntitlements);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const unlockInFlight = useRef(false);

  const refreshEntitlements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserEntitlements();
      setEntitlements(data);
    } catch {
      setEntitlements({
        ...emptyEntitlements(),
        userId: session?.user?.id ?? null,
        subscriptionTier: userStatus === "authenticated_pro" ? "pro" : "free"
      });
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, userStatus]);

  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  const isPro =
    entitlements.subscriptionTier === "pro" || userStatus === "authenticated_pro";

  const isMatchUnlockedFn = useCallback(
    (matchId: string | number) => {
      if (isPro) return true;
      const id = String(matchId);
      const now = Date.now();
      return entitlements.unlockedMatches.some((row) => {
        if (row.matchId !== id) return false;
        if (row.expiresAt) {
          const exp = Date.parse(row.expiresAt);
          if (Number.isFinite(exp) && exp <= now) return false;
        }
        return true;
      });
    },
    [entitlements.unlockedMatches, isPro]
  );

  const remainingUnlocks = isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(0, entitlements.rewardedUnlocksRemaining);

  const canUnlockWithRewardedAdFn = useCallback(
    (featureKey: EntitlementFeatureKey) => {
      if (isPro) return false;
      if (!entitlements.rewardedAdsEnabled) return false;
      if (!MATCH_UNLOCKABLE.has(featureKey)) return false;
      return remainingUnlocks > 0;
    },
    [entitlements.rewardedAdsEnabled, isPro, remainingUnlocks]
  );

  const canAccessFeatureFn = useCallback(
    (featureKey: EntitlementFeatureKey, matchId?: string | number) => {
      if (isPro) return true;
      if (
        featureKey === "match_preview" ||
        featureKey === "difficult_markings_preview" ||
        featureKey === "simulation_preview" ||
        featureKey === "trends_preview"
      ) {
        return true;
      }
      if (PRO_ONLY.has(featureKey)) return false;
      if (MATCH_UNLOCKABLE.has(featureKey)) {
        if (matchId == null) return false;
        return isMatchUnlockedFn(matchId);
      }
      return false;
    },
    [isMatchUnlockedFn, isPro]
  );

  const unlockMatchWithRewardedAd = useCallback(
    async (matchId: number, sourceScreen?: string) => {
      if (unlockInFlight.current || unlocking) return false;
      if (isPro) return true;
      if (isMatchUnlockedFn(matchId)) return true;
      if (remainingUnlocks <= 0) {
        void trackMobileEntitlementEvent("rewarded_daily_limit_reached", {
          matchId: String(matchId),
          remainingUnlocks: 0,
          subscriptionTier: "free",
          sourceScreen
        });
        Alert.alert(
          "Limite giornaliero raggiunto",
          `Hai già usato ${entitlements.dailyRewardedUnlockLimit} sblocchi gratuiti oggi. Passa a Pro per analisi illimitate.`,
          [
            { text: "Chiudi", style: "cancel" },
            {
              text: "Passa a Pro",
              onPress: () => openPaywall("advancedMatchAnalysis")
            }
          ]
        );
        return false;
      }

      unlockInFlight.current = true;
      setUnlocking(true);
      void trackMobileEntitlementEvent("rewarded_unlock_clicked", {
        matchId: String(matchId),
        remainingUnlocks,
        subscriptionTier: "free",
        sourceScreen,
        featureKey: "match_full_analysis"
      });

      try {
        const ads = getRewardedAdsService();
        await ads.load();
        void trackMobileEntitlementEvent("rewarded_ad_loaded", {
          matchId: String(matchId),
          sourceScreen
        });
        void trackMobileEntitlementEvent("rewarded_ad_started", {
          matchId: String(matchId),
          sourceScreen
        });
        const shown = await ads.show({
          customData: session?.user?.id ? `user:${session.user.id}` : undefined
        });
        if (!shown.completed || !shown.rewarded) {
          void trackMobileEntitlementEvent("rewarded_ad_failed", {
            matchId: String(matchId),
            sourceScreen
          });
          Alert.alert(
            "Video non completato",
            shown.error ??
              "La pubblicità non è stata completata. Lo sblocco non è stato attivato."
          );
          return false;
        }

        void trackMobileEntitlementEvent("rewarded_ad_completed", {
          matchId: String(matchId),
          sourceScreen
        });

        const result = await postUnlockMatchWithRewardedAd({
          matchId,
          rewardConfirmed: true,
          adTransactionId: shown.transactionId,
          sourceScreen
        });

        if (!result.ok) {
          if (result.entitlements) setEntitlements(result.entitlements);
          Alert.alert("Sblocco non riuscito", result.message);
          return false;
        }

        setEntitlements(result.entitlements);
        Alert.alert(
          "Partita sbloccata",
          "Hai sbloccato l'analisi completa di questa partita. Ti restano " +
            `${result.entitlements.rewardedUnlocksRemaining} sblocchi gratuiti oggi.`
        );
        return true;
      } catch {
        void trackMobileEntitlementEvent("rewarded_ad_failed", {
          matchId: String(matchId),
          sourceScreen
        });
        Alert.alert("Errore", "Impossibile caricare o mostrare la pubblicità. Riprova più tardi.");
        return false;
      } finally {
        unlockInFlight.current = false;
        setUnlocking(false);
      }
    },
    [
      entitlements.dailyRewardedUnlockLimit,
      isMatchUnlockedFn,
      isPro,
      openPaywall,
      remainingUnlocks,
      session?.user?.id,
      unlocking
    ]
  );

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      entitlements,
      loading,
      unlocking,
      isPro,
      remainingUnlocks: Number.isFinite(remainingUnlocks) ? remainingUnlocks : entitlements.dailyRewardedUnlockLimit,
      refreshEntitlements,
      isMatchUnlocked: isMatchUnlockedFn,
      canAccessFeature: canAccessFeatureFn,
      canUnlockWithRewardedAd: canUnlockWithRewardedAdFn,
      unlockMatchWithRewardedAd,
      getRemainingRewardedUnlocks: () =>
        Number.isFinite(remainingUnlocks) ? remainingUnlocks : entitlements.dailyRewardedUnlockLimit
    }),
    [
      canAccessFeatureFn,
      canUnlockWithRewardedAdFn,
      entitlements,
      isMatchUnlockedFn,
      isPro,
      loading,
      refreshEntitlements,
      remainingUnlocks,
      unlockMatchWithRewardedAd,
      unlocking
    ]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements deve essere usato dentro EntitlementsProvider");
  return ctx;
}
