import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeModule } from "@/lib/home-dashboard/types";
import { colors, radii, spacing } from "@/lib/theme";

function iconName(name: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    "git-compare": "git-network-outline",
    shield: "shield-outline",
    "bar-chart": "bar-chart-outline",
    "person-circle": "person-circle-outline"
  };
  return map[name] ?? "ellipse-outline";
}

export function AnalyticsModuleTile({
  module,
  onPress
}: {
  module: HomeModule;
  onPress: () => void;
}) {
  const disabled = !module.enabled;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <View style={[styles.iconWrap, { borderColor: `${module.color}44` }]}>
        <Ionicons name={iconName(module.icon)} size={24} color={module.color} />
      </View>
      <Text style={styles.title}>{module.title}</Text>
      <Text style={styles.description} numberOfLines={3}>
        {module.description}
      </Text>
      <View style={styles.footer}>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    minHeight: 176,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.92
  },
  disabled: {
    opacity: 0.45
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  title: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  description: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    flex: 1
  },
  footer: {
    marginTop: spacing.sm,
    alignItems: "flex-end"
  }
});
