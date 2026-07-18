import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { colors, radii, spacing } from "@/lib/theme";
import type { FeatureId } from "@/lib/access/types";
import type { EntitlementFeatureKey } from "@/lib/entitlements-types";
import { trackMobileEntitlementEvent } from "@/lib/entitlements/analytics";
import { useEffect } from "react";

export function ProBadge({ label = "Pro" }: { label?: string }) {
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{label}</Text>
    </View>
  );
}

export function RemainingUnlocksIndicator() {
  const { isPro, remainingUnlocks, entitlements } = useEntitlements();
  if (isPro) {
    return <Text style={styles.remainingText}>Pro · analisi illimitate</Text>;
  }
  return (
    <Text style={styles.remainingText}>
      Ti restano {remainingUnlocks} sblocchi gratuiti oggi (max {entitlements.dailyRewardedUnlockLimit})
    </Text>
  );
}

export function RewardedUnlockButton({
  matchId,
  sourceScreen = "match_detail",
  featureKey = "match_full_analysis"
}: {
  matchId: number;
  sourceScreen?: string;
  featureKey?: EntitlementFeatureKey;
}) {
  const { unlocking, unlockMatchWithRewardedAd, canUnlockWithRewardedAd, isMatchUnlocked } =
    useEntitlements();
  const unlocked = isMatchUnlocked(matchId);
  const canUnlock = canUnlockWithRewardedAd(featureKey);

  if (unlocked) return null;

  return (
    <View style={styles.unlockBlock}>
      <RemainingUnlocksIndicator />
      <Pressable
        disabled={unlocking || !canUnlock}
        style={({ pressed }) => [
          styles.unlockBtn,
          (unlocking || !canUnlock) && styles.unlockBtnDisabled,
          pressed && { opacity: 0.9 }
        ]}
        onPress={() => void unlockMatchWithRewardedAd(matchId, sourceScreen)}
      >
        {unlocking ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Ionicons name="play-circle" size={20} color={colors.background} />
            <Text style={styles.unlockBtnText}>
              Guarda un breve video e sblocca l&apos;analisi completa di questa partita
            </Text>
          </>
        )}
      </Pressable>
      {!canUnlock ? (
        <Text style={styles.hint}>
          Limite giornaliero raggiunto oppure accedi per usare gli sblocchi video.
        </Text>
      ) : null}
    </View>
  );
}

export function ProUpgradeCard({
  feature = "advancedMatchAnalysis",
  title = "Passa a Pro",
  body = "Analisi illimitate, trend e marcature complete, simulazioni personalizzabili e nessuna pubblicità."
}: {
  feature?: FeatureId;
  title?: string;
  body?: string;
}) {
  const { openPaywall } = useAccessFlow();
  useEffect(() => {
    void trackMobileEntitlementEvent("pro_paywall_viewed", {
      featureKey: feature,
      sourceScreen: "pro_upgrade_card"
    });
  }, [feature]);

  return (
    <View style={styles.upgradeCard}>
      <View style={styles.upgradeHeader}>
        <Text style={styles.upgradeTitle}>{title}</Text>
        <ProBadge />
      </View>
      <Text style={styles.upgradeBody}>{body}</Text>
      <Pressable
        style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.92 }]}
        onPress={() => {
          void trackMobileEntitlementEvent("pro_upgrade_clicked", { featureKey: feature });
          openPaywall(feature);
        }}
      >
        <Text style={styles.upgradeBtnText}>Passa a Pro</Text>
      </Pressable>
    </View>
  );
}

export function LockedContentPreview({
  title,
  description,
  matchId,
  lockedCount,
  sourceScreen
}: {
  title: string;
  description: string;
  matchId?: number;
  lockedCount?: number;
  sourceScreen?: string;
}) {
  useEffect(() => {
    void trackMobileEntitlementEvent("locked_feature_viewed", {
      matchId: matchId != null ? String(matchId) : undefined,
      sourceScreen,
      featureKey: title
    });
    void trackMobileEntitlementEvent("premium_preview_viewed", {
      matchId: matchId != null ? String(matchId) : undefined,
      sourceScreen
    });
  }, [matchId, sourceScreen, title]);

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedHeader}>
        <Text style={styles.lockedTitle}>{title}</Text>
        {matchId != null ? (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>Sbloccabile con video</Text>
          </View>
        ) : (
          <ProBadge />
        )}
      </View>
      <Text style={styles.lockedBody}>{description}</Text>
      {lockedCount != null && lockedCount > 0 ? (
        <Text style={styles.lockedMeta}>+{lockedCount} contenuti aggiuntivi disponibili</Text>
      ) : null}
      <View style={styles.lockedActions}>
        {matchId != null ? <RewardedUnlockButton matchId={matchId} sourceScreen={sourceScreen} /> : null}
        <ProUpgradeCard />
      </View>
    </View>
  );
}

export function FeatureGate({
  allowed,
  children,
  fallback
}: {
  allowed: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  if (allowed) return <>{children}</>;
  return <>{fallback}</>;
}

const styles = StyleSheet.create({
  proBadge: {
    backgroundColor: "rgba(252,211,77,0.15)",
    borderColor: "rgba(252,211,77,0.35)",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  proBadgeText: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  remainingText: {
    color: colors.cyanMuted,
    fontSize: 12,
    marginBottom: spacing.sm
  },
  unlockBlock: {
    gap: spacing.sm,
    marginVertical: spacing.sm
  },
  unlockBtn: {
    backgroundColor: colors.cyan,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  unlockBtnDisabled: {
    opacity: 0.55
  },
  unlockBtnText: {
    color: colors.background,
    fontWeight: "800",
    fontSize: 13,
    flex: 1,
    lineHeight: 18
  },
  hint: {
    color: colors.textDim,
    fontSize: 12
  },
  upgradeCard: {
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.25)",
    backgroundColor: "rgba(252,211,77,0.06)",
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  upgradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  upgradeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  upgradeBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  upgradeBtn: {
    backgroundColor: colors.amber,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  upgradeBtnText: {
    color: "#1a1200",
    fontWeight: "900",
    fontSize: 14
  },
  lockedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  lockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  lockedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    flex: 1
  },
  lockedBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  lockedMeta: {
    color: colors.cyanMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  lockedActions: {
    gap: spacing.sm
  },
  videoBadge: {
    backgroundColor: "rgba(103,232,249,0.12)",
    borderColor: "rgba(103,232,249,0.3)",
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  videoBadgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: "800"
  }
});
