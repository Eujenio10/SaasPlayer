import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppMenuButton } from "@/components/app-menu/AppMenuButton";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { MarkingPlayerCard } from "@/components/difficult-markings/DifficultMarkingsList";
import { FavoriteTeamPickerModal } from "@/components/favorite-team/FavoriteTeamPickerModal";
import { FollowedTeamNotificationsCard } from "@/components/favorite-team/FollowedTeamNotificationsCard";
import { MatchRow } from "@/components/MatchRow";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { RefereeStatsBadge } from "@/components/referees/RefereeStatsBadge";
import { useFavoriteTeam } from "@/contexts/FavoriteTeamContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useYourTeamFeed } from "@/lib/favorite-team/useYourTeamFeed";
import { genericTeamColor, teamInitialsFromName } from "@/lib/match-display";
import { matchHubHref } from "@/lib/matches/open-match";
import { metricLabelIt } from "@/lib/trends/text";
import { spacing } from "@/lib/theme";

export function YourTeamScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { favoriteTeams, activeTeam, setActiveTeamId, removeFavoriteTeam } = useFavoriteTeam();
  const { data, loading, error, refetch } = useYourTeamFeed(activeTeam);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedMarkingId, setExpandedMarkingId] = useState<string | null>(null);
  const color = activeTeam ? genericTeamColor(activeTeam.teamName) : analysisColors.green;

  useEffect(() => {
    setExpandedMarkingId(null);
  }, [activeTeam?.teamId]);

  const openMatch = (eventId: number, home: string, away: string, competition: string, homeTeamId: number, awayTeamId: number, startTimestamp: number) => {
    router.push({
      pathname: "/match/[eventId]",
      params: {
        eventId: String(eventId),
        home,
        away,
        competition,
        homeTeamId: String(homeTeamId),
        awayTeamId: String(awayTeamId),
        startTimestamp: String(startTimestamp)
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
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
        <View style={styles.brandRow}>
          <AppMenuButton />
          <Text style={styles.brand}>
            <Text style={styles.brandPitch}>Pitch</Text>
            <Text style={styles.brandBrain}>Brain</Text>
          </Text>
        </View>

        <Text style={styles.pageTitle}>{t("yourTeam.sectionTitle")}</Text>
        <Text style={styles.subtitle}>{t("yourTeam.subtitle")}</Text>
        <FollowedTeamNotificationsCard />

        {!favoriteTeams.length ? (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.pickCard, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.pickTitle}>{t("yourTeam.pickTitle")}</Text>
            <Text style={styles.pickBody}>{t("yourTeam.homeBodyGuest")}</Text>
            <Text style={styles.link}>{t("yourTeam.choose")}</Text>
          </Pressable>
        ) : (
          <>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.menu}
            >
              {favoriteTeams.map((team) => {
                const selected = activeTeam?.teamId === team.teamId;
                const chipColor = genericTeamColor(team.teamName);
                return (
                  <View key={team.teamId} style={[styles.menuChip, selected && styles.menuChipOn]}>
                    <Pressable
                      onPress={() => void setActiveTeamId(team.teamId)}
                      style={styles.menuChipMain}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={[styles.menuAvatar, { borderColor: `${chipColor}88` }]}>
                        <Text style={[styles.menuAvatarText, { color: chipColor }]}>
                          {teamInitialsFromName(team.teamName)}
                        </Text>
                      </View>
                      <Text style={[styles.menuLabel, selected && styles.menuLabelOn]} numberOfLines={1}>
                        {team.teamName}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void removeFavoriteTeam(team.teamId)}
                      hitSlop={8}
                      accessibilityLabel={t("yourTeam.removeA11y", { team: team.teamName })}
                    >
                      <Text style={styles.menuRemove}>×</Text>
                    </Pressable>
                  </View>
                );
              })}
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={styles.menuAdd}
                accessibilityRole="button"
                accessibilityLabel={t("yourTeam.addMore")}
              >
                <Text style={styles.menuAddText}>+</Text>
              </Pressable>
            </ScrollView>

            {activeTeam ? (
              <View style={styles.teamHeader}>
                <View style={[styles.avatar, { borderColor: `${color}88` }]}>
                  <Text style={[styles.avatarText, { color }]}>{teamInitialsFromName(activeTeam.teamName)}</Text>
                </View>
                <Text style={styles.teamName}>{activeTeam.teamName}</Text>
              </View>
            ) : null}

            {error ? <Text style={styles.empty}>{t("yourTeam.loadFailed")}</Text> : null}

            {data?.nextMatch ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("yourTeam.nextMatch")}</Text>
                <MatchRow
                  match={data.nextMatch}
                  onPress={() =>
                    openMatch(
                      data.nextMatch!.eventId,
                      data.nextMatch!.homeTeam.name,
                      data.nextMatch!.awayTeam.name,
                      data.nextMatch!.competitionName,
                      data.nextMatch!.homeTeam.id,
                      data.nextMatch!.awayTeam.id,
                      data.nextMatch!.startTimestamp
                    )
                  }
                />
                <View style={styles.analysisRow}>
                  {(
                    [
                      ["fouls", t("matchHub.foulsTitle")],
                      ["performance", t("matchHub.performanceTitle")],
                      ["prematch", t("matchHub.prematchTitle")]
                    ] as const
                  ).map(([screen, label]) => (
                    <Pressable
                      key={screen}
                      onPress={() =>
                        router.push({
                          pathname:
                            screen === "fouls"
                              ? "/match/[eventId]/fouls"
                              : screen === "performance"
                                ? "/match/[eventId]/performance"
                                : "/match/[eventId]/prematch",
                          params: {
                            eventId: String(data.nextMatch!.eventId),
                            home: data.nextMatch!.homeTeam.name,
                            away: data.nextMatch!.awayTeam.name,
                            competition: data.nextMatch!.competitionName,
                            homeTeamId: String(data.nextMatch!.homeTeam.id),
                            awayTeamId: String(data.nextMatch!.awayTeam.id),
                            startTimestamp: String(data.nextMatch!.startTimestamp)
                          }
                        })
                      }
                      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.88 }]}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : !loading ? (
              <Text style={styles.empty}>{t("yourTeam.noMatches")}</Text>
            ) : null}

            {data && data.matches.length > 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("yourTeam.otherMatches")}</Text>
                {data.matches.slice(1, 4).map((match) => (
                  <MatchRow key={match.eventId} match={match} onPress={() => router.push(matchHubHref(match))} />
                ))}
              </View>
            ) : null}

            {data?.refereeMatch?.stats ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("yourTeam.referee")}</Text>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLead}>
                    {t("referees.referee")}: {data.refereeMatch.referee?.name ?? t("referees.unnamed")}
                  </Text>
                  <RefereeStatsBadge
                    yellowAverage={data.refereeMatch.stats.yellowAverage}
                    redAverage={data.refereeMatch.stats.redAverage}
                  />
                  <Pressable onPress={() => router.push("/referees" as Href)} hitSlop={8}>
                    <Text style={styles.link}>{t("yourTeam.seeAllReferees")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {data?.trends.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("yourTeam.trends")}</Text>
                {data.trends.map((trend) => (
                  <Pressable
                    key={trend.id}
                    onPress={() => router.push("/trends")}
                    style={({ pressed }) => [styles.infoCard, pressed && { opacity: 0.92 }]}
                  >
                    <Text style={styles.infoLead}>{trend.playerName}</Text>
                    <Text style={styles.infoMeta}>
                      {metricLabelIt(trend.metric)} · {Math.round(trend.relativeDelta * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {data?.markings.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("yourTeam.markings")}</Text>
                {data.markings.map((row, index) => {
                  const expanded = expandedMarkingId === row.id;
                  return (
                    <MarkingPlayerCard
                      key={row.id}
                      matchup={row}
                      featured={expanded}
                      rank={index + 1}
                      expanded={expanded}
                      onToggle={() => setExpandedMarkingId((current) => (current === row.id ? null : row.id))}
                    />
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <PitchBrainLoading visible={loading && !data && !!activeTeam} />
      <FavoriteTeamPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: analysisColors.bg
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  brand: {
    fontSize: 22,
    fontWeight: "800"
  },
  brandPitch: {
    color: analysisColors.text
  },
  brandBrain: {
    color: analysisColors.green
  },
  pageTitle: {
    color: analysisColors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: analysisColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm
  },
  menu: {
    gap: 8,
    paddingBottom: 4
  },
  menuChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10
  },
  menuChipMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0
  },
  menuChipOn: {
    borderColor: analysisColors.borderStrong,
    backgroundColor: analysisColors.cardAlt
  },
  menuAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  menuAvatarText: {
    fontSize: 10,
    fontWeight: "800"
  },
  menuLabel: {
    flexShrink: 1,
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  menuLabelOn: {
    color: analysisColors.text
  },
  menuRemove: {
    color: analysisColors.textMuted,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18
  },
  menuAdd: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: analysisColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: analysisColors.card
  },
  menuAddText: {
    color: analysisColors.green,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24
  },
  pickCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 16,
    gap: 8
  },
  pickTitle: {
    color: analysisColors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  pickBody: {
    color: analysisColors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.sm
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800"
  },
  teamName: {
    flex: 1,
    color: analysisColors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  section: {
    gap: 10,
    marginTop: spacing.sm
  },
  sectionTitle: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  analysisRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: {
    color: analysisColors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 14,
    gap: 8
  },
  infoLead: {
    color: analysisColors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  infoMeta: {
    color: analysisColors.textMuted,
    fontSize: 13
  },
  link: {
    color: analysisColors.green,
    fontSize: 13,
    fontWeight: "800"
  },
  empty: {
    color: analysisColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm
  }
});
