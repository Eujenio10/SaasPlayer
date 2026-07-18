import { Pressable, StyleSheet, Text, View } from "react-native";
import { PitchBrainLogo } from "@/components/home/PitchBrainLogo";
import type { UserAccessRole } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme";

function accessBadgeLabel(role: UserAccessRole, isPro: boolean, isGuest?: boolean): string {
  if (isGuest) return "Modalità Guest";
  if (role === "admin") return "Accesso Admin attivo";
  if (isPro) return "Accesso Pro attivo";
  return "Accesso Membro attivo";
}

export function HomeHeader({
  role,
  isPro,
  isGuest,
  onAdminRefresh,
  adminRefreshing
}: {
  role?: UserAccessRole;
  isPro?: boolean;
  isGuest?: boolean;
  onAdminRefresh?: () => void;
  adminRefreshing?: boolean;
}) {
  const badgeLabel = accessBadgeLabel(role ?? "member", Boolean(isPro), isGuest);

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <PitchBrainLogo />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>PitchBrain</Text>
          <Text style={styles.brandTagline}>Intelligenza tattica calcistica</Text>
        </View>
      </View>

      <View style={styles.rightCol}>
        {onAdminRefresh ? (
          <Pressable
            onPress={onAdminRefresh}
            disabled={adminRefreshing}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.refreshText}>{adminRefreshing ? "…" : "↻"}</Text>
          </Pressable>
        ) : null}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1
  },
  brandText: {
    flex: 1,
    gap: 2
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  brandTagline: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  rightCol: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.28)",
    backgroundColor: "rgba(16,185,129,0.08)"
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.emerald
  },
  badgeText: {
    color: colors.emerald,
    fontSize: 9,
    fontWeight: "800"
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  refreshText: {
    color: colors.cyan,
    fontSize: 16,
    fontWeight: "800"
  }
});
