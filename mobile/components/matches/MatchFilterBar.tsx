import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MatchFilterId } from "@/lib/matches/filters";
import { colors, radii, spacing } from "@/lib/theme";

const filters: Array<{
  id: MatchFilterId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "all", label: "Tutte", icon: "list-outline" },
  { id: "today", label: "Oggi", icon: "calendar-outline" },
  { id: "world", label: "Mondiali", icon: "globe-outline" },
  { id: "intensity", label: "Intensità", icon: "stats-chart-outline" }
];

export function MatchFilterBar({
  active,
  onChange
}: {
  active: MatchFilterId;
  onChange: (id: MatchFilterId) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {filters.map((filter) => {
        const selected = active === filter.id;
        return (
          <Pressable
            key={filter.id}
            onPress={() => onChange(filter.id)}
            style={[styles.chip, selected && styles.chipActive]}
          >
            <Ionicons
              name={filter.icon}
              size={14}
              color={selected ? colors.cyan : colors.textMuted}
            />
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingBottom: spacing.sm
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: {
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chipTextActive: {
    color: colors.cyan
  }
});
