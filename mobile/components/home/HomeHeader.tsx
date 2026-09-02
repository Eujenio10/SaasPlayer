import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserAccessRole } from "@/lib/types";
import { homeColors } from "@/components/home/home-theme";
import { LanguageToggle } from "@/components/home/LanguageToggle";
import { useLocale } from "@/contexts/LocaleContext";
import { spacing } from "@/lib/theme";

function accessBadgeLabel(role: UserAccessRole, isGuest?: boolean): string {
  if (isGuest) return "GUEST";
  if (role === "admin") return "ADMIN";
  if (role === "pro") return "PRO";
  return "FREE";
}

export function HomeHeader({
  role,
  isGuest,
  onAdminRefresh,
  adminRefreshing,
  onBadgePress
}: {
  role?: UserAccessRole;
  isPro?: boolean;
  isGuest?: boolean;
  onAdminRefresh?: () => void;
  adminRefreshing?: boolean;
  onBadgePress?: () => void;
}) {
  const { t } = useLocale();
  const badgeLabel = accessBadgeLabel(role ?? "member", isGuest);

  return (
    <View style={styles.wrap}>
      <View style={styles.brandCol}>
        <Text style={styles.brand} accessibilityRole="header">
          <Text style={styles.pitch}>Pitch</Text>
          <Text style={styles.brain}>Brain</Text>
        </Text>
        <Text style={styles.tagline}>{t("home.tagline")}</Text>
      </View>

      <View style={styles.rightCol}>
        <LanguageToggle />
        {onAdminRefresh ? (
          <Pressable
            onPress={onAdminRefresh}
            disabled={adminRefreshing}
            accessibilityRole="button"
            accessibilityLabel={t("home.refreshData")}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.refreshText}>{adminRefreshing ? "…" : "↻"}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onBadgePress}
          disabled={!onBadgePress}
          accessibilityRole={onBadgePress ? "button" : "text"}
          accessibilityLabel={badgeLabel}
          style={({ pressed }) => [styles.badge, pressed && onBadgePress ? { opacity: 0.85 } : null]}
        >
          <Ionicons name="person-outline" size={13} color={homeColors.green} />
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md
  },
  brandCol: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36
  },
  pitch: {
    color: homeColors.textPitch
  },
  brain: {
    color: homeColors.green
  },
  tagline: {
    color: homeColors.textMuted,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.1
  },
  rightCol: {
    alignItems: "flex-end",
    gap: spacing.xs,
    paddingTop: 4
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeColors.borderStrong,
    backgroundColor: "rgba(23,53,26,0.35)"
  },
  badgeText: {
    color: homeColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: homeColors.card
  },
  refreshText: {
    color: homeColors.green,
    fontSize: 16,
    fontWeight: "800"
  }
});
