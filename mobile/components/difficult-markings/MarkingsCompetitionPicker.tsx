import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { MARKINGS_COMPETITIONS } from "@/lib/difficult-markings/types";
import { colors, radii, spacing } from "@/lib/theme";

export function MarkingsCompetitionPicker({
  active,
  onChange
}: {
  active: string;
  onChange: (competitionId: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {MARKINGS_COMPETITIONS.map((competition) => {
        const selected = active === competition.id;
        return (
          <Pressable
            key={competition.id}
            onPress={() => onChange(competition.id)}
            style={[styles.chip, selected && styles.chipActive]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
              {competition.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingBottom: spacing.xs
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: {
    borderColor: "rgba(251,146,60,0.45)",
    backgroundColor: "rgba(251,146,60,0.12)"
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#fb923c"
  }
});
