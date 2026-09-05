import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { MarkingsCompetitionPicker } from "@/components/difficult-markings/MarkingsCompetitionPicker";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { RefereeSeverityCard } from "@/components/referees/RefereeSeverityCard";
import { useLocale } from "@/contexts/LocaleContext";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { useRefereeSeverity } from "@/lib/referees/useRefereeSeverity";
import { spacing } from "@/lib/theme";

export function RefereeSeverityScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const [competitionId, setCompetitionId] = useState<string>(DEFAULT_MENU_COMPETITION_ID);
  const { data, loading, error, refetch } = useRefereeSeverity(competitionId);
  const firstLoad = loading && !data;
  const matches = data?.matches ?? [];
  const availableIds = useMemo(
    () => data?.availableCompetitionIds ?? [competitionId],
    [competitionId, data?.availableCompetitionIds]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={() => void refetch()}
            tintColor={analysisColors.green}
          />
        }
      >
        <AnalysisNavHeader backLabel={t("referees.back")} title={t("referees.title")} />
        <Text style={styles.subtitle}>{t("referees.subtitle")}</Text>

        <MarkingsCompetitionPicker
          active={competitionId}
          onChange={setCompetitionId}
          availableIds={availableIds}
          variant="matrix"
        />

        {data?.round ? (
          <Text style={styles.meta}>
            {t("referees.competition")}: {data.competitionName}
            {"   "}
            {t("referees.round")}: {data.round}
          </Text>
        ) : (
          <Text style={styles.meta}>
            {t("referees.competition")}: {data?.competitionName ?? ""}
          </Text>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{t("referees.info")}</Text>
        </View>

        {error && !data ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("referees.loadFailed")}</Text>
            <Pressable onPress={() => void refetch()} style={styles.retry}>
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!firstLoad && !error && matches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("referees.empty")}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {matches.map((item) => (
            <RefereeSeverityCard
              key={item.eventId}
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/match/[eventId]",
                  params: {
                    eventId: String(item.eventId),
                    home: item.homeTeam.name,
                    away: item.awayTeam.name,
                    competition: data?.competitionName ?? "",
                    homeTeamId: String(item.homeTeam.id),
                    awayTeamId: String(item.awayTeam.id),
                    ...(item.startTimestamp ? { startTimestamp: String(item.startTimestamp) } : {})
                  }
                })
              }
            />
          ))}
        </View>
      </ScrollView>
      <PitchBrainLoading visible={firstLoad} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: analysisColors.bg
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: 12
  },
  subtitle: {
    color: analysisColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500"
  },
  meta: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  infoText: {
    color: analysisColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500"
  },
  list: {
    gap: 10
  },
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 16,
    gap: 10
  },
  emptyText: {
    color: analysisColors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center"
  },
  retryText: {
    color: analysisColors.green,
    fontSize: 13,
    fontWeight: "800"
  }
});
