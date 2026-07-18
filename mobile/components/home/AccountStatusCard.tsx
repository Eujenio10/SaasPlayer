import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeDashboardUser } from "@/lib/home-dashboard/types";
import { colors, radii, spacing } from "@/lib/theme";

interface AccountStatusCardProps {
  user: HomeDashboardUser;
  onManage?: () => void;
}

export function AccountStatusCard({ user, onManage }: AccountStatusCardProps) {
  const active = user.accessStatus === "active";

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />
        <Text style={styles.status}>{active ? "Accesso attivo" : "Accesso non attivo"}</Text>
        {onManage ? (
          <Pressable onPress={onManage} hitSlop={8}>
            <Text style={styles.manage}>Gestisci</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.email} numberOfLines={1}>
        {user.email}
      </Text>
      <Text style={styles.plan}>Piano {user.planName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.22)",
    backgroundColor: "rgba(16,185,129,0.07)"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  dotActive: {
    backgroundColor: colors.emerald
  },
  dotInactive: {
    backgroundColor: colors.danger
  },
  status: {
    flex: 1,
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800"
  },
  manage: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800"
  },
  email: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  plan: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13
  }
});
