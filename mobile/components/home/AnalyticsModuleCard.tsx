import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeModule } from "@/lib/home-dashboard/types";
import { colors, radii, spacing } from "@/lib/theme";

function iconName(name: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    "git-compare": "git-compare",
    warning: "warning",
    "person-circle": "person-circle",
    shield: "shield-outline",
    "trending-up": "trending-up",
    "stats-chart": "stats-chart",
    "bar-chart": "bar-chart"
  };
  return map[name] ?? "ellipse";
}

interface AnalyticsModuleCardProps {
  module: HomeModule;
  onPress: () => void;
}

export function AnalyticsModuleCard({ module, onPress }: AnalyticsModuleCardProps) {
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
        <Ionicons name={iconName(module.icon)} size={22} color={module.color} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{module.title}</Text>
          {module.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{module.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.description}>{module.description}</Text>
        {disabled ? <Text style={styles.locked}>Bloccato sul tuo piano</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.9
  },
  disabled: {
    opacity: 0.5
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  body: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: "rgba(56,189,248,0.12)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)"
  },
  badgeText: {
    color: colors.cyan,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  description: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  locked: {
    marginTop: 4,
    color: colors.rose,
    fontSize: 11,
    fontWeight: "700"
  }
});
