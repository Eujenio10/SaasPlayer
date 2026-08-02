import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { filterCompetitionsByAvailableIds } from "@/lib/competitions-with-matches";
import type { MatchFilterId, MatchModeFilterId } from "@/lib/matches/filters";
import { colors, radii, spacing } from "@/lib/theme";

const modeFilters: Array<{
  id: MatchModeFilterId;
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
  onChange,
  hasWorldCupMatches = true,
  hasTodayMatches = true,
  availableCompetitionIds = null
}: {
  active: MatchFilterId;
  onChange: (id: MatchFilterId) => void;
  hasWorldCupMatches?: boolean;
  hasTodayMatches?: boolean;
  /** Competizioni con ≥1 partita (Top5 + UEFA + internazionali). */
  availableCompetitionIds?: string[] | null;
}) {
  const modes = modeFilters.filter((filter) => {
    if (filter.id === "world") return hasWorldCupMatches;
    if (filter.id === "today") return hasTodayMatches;
    return true;
  });

  const competitions = useMemo(
    () =>
      filterCompetitionsByAvailableIds(availableCompetitionIds).filter(
        (c) => c.id !== "world-cup"
      ),
    [availableCompetitionIds]
  );

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {modes.map((filter) => {
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

      {competitions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {competitions.map((competition) => {
            const selected = active === competition.id;
            return (
              <Pressable
                key={competition.id}
                onPress={() => onChange(competition.id)}
                style={[styles.chip, styles.compChip, selected && styles.compChipActive]}
              >
                <Text
                  style={[styles.chipText, selected && styles.compChipTextActive]}
                  numberOfLines={1}
                >
                  {competition.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
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
  },
  compChip: {
    maxWidth: 160
  },
  compChipActive: {
    borderColor: "rgba(251,146,60,0.45)",
    backgroundColor: "rgba(251,146,60,0.12)"
  },
  compChipTextActive: {
    color: "#fb923c"
  }
});
