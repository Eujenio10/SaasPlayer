import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { filterCompetitionsByAvailableIds } from "@/lib/competitions-with-matches";
import { colors, radii, spacing } from "@/lib/theme";

export function MarkingsCompetitionPicker({
  active,
  onChange,
  availableIds
}: {
  active: string;
  onChange: (competitionId: string) => void;
  /** Se valorizzato, mostra solo questi campionati (con almeno 1 partita). */
  availableIds?: string[] | null;
}) {
  const options = useMemo(
    () => filterCompetitionsByAvailableIds(availableIds),
    [availableIds]
  );

  useEffect(() => {
    if (options.length === 0) return;
    if (!options.some((c) => c.id === active)) {
      onChange(options[0].id);
    }
  }, [active, onChange, options]);

  if (options.length === 0) {
    return (
      <Text style={styles.empty}>
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
  },
  empty: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm
  }
});
