import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { filterCompetitionsByAvailableIds } from "@/lib/competitions-with-matches";
import type { MatchFilterId, MatchModeFilterId } from "@/lib/matches/filters";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { localizedCompetitionLabel } from "@/lib/i18n";

const modeFilterIds: MatchModeFilterId[] = ["all", "today", "intensity"];

export function MatchFilterBar({
  active,
  onChange,
  hasWorldCupMatches = true,
  availableCompetitionIds = null
}: {
  active: MatchFilterId;
  onChange: (id: MatchFilterId) => void;
  hasWorldCupMatches?: boolean;
  hasTodayMatches?: boolean;
  hasIntensityMatches?: boolean;
  availableCompetitionIds?: string[] | null;
}) {
  const { t } = useLocale();
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {modeFilterIds.map((id) => {
          const selected = active === id;
          const label =
            id === "all" ? t("common.all") : id === "today" ? t("common.today") : t("common.intensity");
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              style={[styles.modeChip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
        {competitions.map((competition) => {
          const selected = active === competition.id;
          return (
            <Pressable
              key={competition.id}
              onPress={() => onChange(competition.id)}
              style={[styles.compChip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
                {localizedCompetitionLabel(competition.id, competition.label)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
    paddingBottom: 2
  },
  modeChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.borderStrong,
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
