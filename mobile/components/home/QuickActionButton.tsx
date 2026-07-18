import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeQuickAction } from "@/lib/home-dashboard/types";
import { colors, radii, spacing } from "@/lib/theme";

function iconName(name: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    football: "football",
    warning: "warning",
    "document-text": "document-text",
    "trending-up": "trending-up",
    shield: "shield-outline",
    "stats-chart": "stats-chart"
  };
  return map[name] ?? "ellipse";
}

interface QuickActionButtonProps {
  action: HomeQuickAction;
  onPress: () => void;
}

export function QuickActionButton({ action, onPress }: QuickActionButtonProps) {
  if (!action.enabled) return null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Ionicons name={iconName(action.icon)} size={20} color={colors.cyan} />
      <Text style={styles.label}>{action.label}</Text>
    </Pressable>
  );
}

interface QuickActionsRowProps {
  actions: HomeQuickAction[];
  onActionPress: (route: string) => void;
}

export function QuickActionsRow({ actions, onActionPress }: QuickActionsRowProps) {
  const visible = actions.filter((a) => a.enabled);
  if (!visible.length) return null;

  return (
    <View style={styles.row}>
      {visible.map((action) => (
        <QuickActionButton key={action.id} action={action} onPress={() => onActionPress(action.route)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  btn: {
    flexGrow: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.06)"
  },
  pressed: {
    opacity: 0.88
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  }
});
