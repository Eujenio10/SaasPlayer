import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { filterCompetitionsByAvailableIds } from "@/lib/competitions-with-matches";
import type { MatchFilterId, MatchModeFilterId } from "@/lib/matches/filters";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { spacing } from "@/lib/theme";

const modeFilters: Array<{ id: MatchModeFilterId; label: string }> = [
  { id: "all", label: "Tutte" },
  { id: "today", label: "Oggi" }
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
  availableCompetitionIds?: string[] | null;
}) {
  const modes = modeFilters.filter((filter) => {
    if (filter.id === "today") return hasTodayMatches;
    return true;
  });

  const competitions = useMemo(
    () =>
      filterCompetitionsByAvailableIds(availableCompetitionIds).filter((competition) => {
        if (competition.id === "world-cup") return hasWorldCupMatches;
        return true;
      }),
    [availableCompetitionIds, hasWorldCupMatches]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.modeRow}>
        {modes.map((filter) => {
          const selected = active === filter.id;
          return (
            <Pressable
              key={filter.id}
              onPress={() => onChange(filter.id)}
              style={[styles.modeChip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {competitions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compRow}>
          {competitions.map((competition) => {
            const selected = active === competition.id;
            return (
              <Pressable
                key={competition.id}
                onPress={() => onChange(competition.id)}
                style={[styles.compChip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
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
    gap: 8
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  compRow: {
    gap: 8,
    paddingBottom: 2
  },
  modeChip: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  compChip: {
    minHeight: 40,
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  chipActive: {
    borderColor: analysisColors.borderStrong,
    backgroundColor: "rgba(124,255,58,0.12)",
    shadowColor: analysisColors.green,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }
  },
  chipText: {
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  chipTextActive: {
    color: analysisColors.green
  }
});
