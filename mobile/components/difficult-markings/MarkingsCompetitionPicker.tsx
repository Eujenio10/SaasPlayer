import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useEffect, useMemo } from "react";
import { filterCompetitionsByAvailableIds } from "@/lib/competitions-with-matches";
import { markingsColors } from "@/components/difficult-markings/markings-theme";
import { colors, radii, spacing } from "@/lib/theme";

export function MarkingsCompetitionPicker({
  active,
  onChange,
  availableIds,
  variant = "default"
}: {
  active: string;
  onChange: (competitionId: string) => void;
  /** Se valorizzato, mostra solo questi campionati (con almeno 1 partita). */
  availableIds?: string[] | null;
  variant?: "default" | "matrix";
}) {
  const options = useMemo(
    () => filterCompetitionsByAvailableIds(availableIds),
    [availableIds]
  );
  const matrix = variant === "matrix";

  useEffect(() => {
    if (options.length === 0) return;
    if (!options.some((c) => c.id === active)) {
      onChange(options[0].id);
    }
  }, [active, onChange, options]);

  if (options.length === 0) {
    return (
      <Text style={[styles.empty, matrix && styles.emptyMatrix]}>
        Nessun campionato con partite da analizzare al momento.
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((competition) => {
        const selected = active === competition.id;
        return (
          <Pressable
            key={competition.id}
            onPress={() => onChange(competition.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              matrix && styles.chipMatrix,
              selected && (matrix ? styles.chipActiveMatrix : styles.chipActive)
            ]}
          >
            <Text
              style={[
                styles.chipText,
                matrix && styles.chipTextMatrix,
                selected && (matrix ? styles.chipTextActiveMatrix : styles.chipTextActive)
              ]}
            >
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
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center"
  },
  chipMatrix: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: markingsColors.bgAlt
  },
  chipActive: {
    borderColor: "rgba(251,146,60,0.45)",
    backgroundColor: "rgba(251,146,60,0.12)"
  },
  chipActiveMatrix: {
    borderColor: markingsColors.borderStrong,
    backgroundColor: markingsColors.bgAlt
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chipTextMatrix: {
    color: markingsColors.textMuted
  },
  chipTextActive: {
    color: "#fb923c"
  },
  chipTextActiveMatrix: {
    color: markingsColors.green
  },
  empty: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm
  },
  emptyMatrix: {
    color: markingsColors.textDim
  }
});
