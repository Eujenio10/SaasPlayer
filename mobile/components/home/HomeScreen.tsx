import { useEffect } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeHeader } from "@/components/home/HomeHeader";
import { LanguageToggle } from "@/components/home/LanguageToggle";
import { ErrorState } from "@/components/home/ErrorState";
import { FeaturedMatchCard } from "@/components/home/FeaturedMatchCard";
import { HomeLoadingSkeleton } from "@/components/home/LoadingSkeleton";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { UpcomingMatchesSection } from "@/components/home/UpcomingMatchesSection";
import { MatchRadarHomeCta } from "@/components/match-radar/MatchRadarHomeCta";
import { RefereeSeverityHomeCta } from "@/components/referees/RefereeSeverityHomeCta";
import { EarlySeasonNoticeBanner } from "@/components/home/EarlySeasonNoticeBanner";
import { homeColors } from "@/components/home/home-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { shouldObscureGuestStats } from "@/lib/access/guest-preview-mode";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import type { HomeUpcomingMatch } from "@/lib/home-dashboard/types";
import { useHomeDashboard } from "@/lib/home-dashboard/useHomeDashboard";
import { useAdminMatchesRefresh } from "@/lib/matches/useAdminMatchesRefresh";
import { useDeferredLoading } from "@/lib/use-deferred-loading";
import { useLocale } from "@/contexts/LocaleContext";
import { LOCALE_BCP47 } from "@/lib/i18n";
import { spacing } from "@/lib/theme";

function formatLastRefreshClock(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { access, userStatus } = useAuth();
  const { previewActive } = useGuestPreview();
  const { data, loading, error, refetch } = useHomeDashboard();
  const adminRefresh = useAdminMatchesRefresh(() => void refetch());
  const firstLoad = loading && !data;
  const showOverlay = useDeferredLoading(firstLoad);

  useEffect(() => subscribeAdminCatalogRefresh(() => void refetch()), [refetch]);

  const isGuest = userStatus === "guest";
  const obscureStats = shouldObscureGuestStats(userStatus, previewActive);
  const lastRefreshClock = formatLastRefreshClock(data?.dataRefresh.lastRefreshAt, LOCALE_BCP47[locale]);
  const upcomingMatches = data?.upcomingMatches ?? [];

  const openMatch = (
    eventId: number,
    home: string,
    away: string,
    competition: string,
    homeTeamId: number,
    awayTeamId: number,
    startTimestamp?: number
  ) => {
    router.push({
      pathname: "/match/[eventId]",
      params: {
        eventId: String(eventId),
        home,
        away,
        competition,
        homeTeamId: String(homeTeamId),
        awayTeamId: String(awayTeamId),
        ...(startTimestamp ? { startTimestamp: String(startTimestamp) } : {})
      }
    });
  };

  const openUpcoming = (match: HomeUpcomingMatch) => {
    openMatch(
      match.id,
      match.homeTeamName,
      match.awayTeamName,
      match.competitionName,
      match.homeTeamId,
      match.awayTeamId,
      match.startTimestamp
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={() => void refetch()}
            tintColor={homeColors.green}
          />
        }
      >
        <HomeHeader
          role={data?.user.role ?? access?.role}
          isGuest={isGuest}
          onAdminRefresh={access?.canRefreshData ? () => void adminRefresh.refresh() : undefined}
          adminRefreshing={adminRefresh.refreshing}
          onBadgePress={() => router.push("/profile")}
        />

        <LanguageToggle />

        {firstLoad && !showOverlay ? <HomeLoadingSkeleton /> : null}

        <View style={styles.content}>
          <EarlySeasonNoticeBanner message={data?.earlySeasonNotice} />

          {error && !data && !isGuest ? (
            <ErrorState message={error} onRetry={() => void refetch()} />
          ) : null}

          {error && !data && isGuest ? (
            <View style={styles.guestNotice}>
              <Text style={styles.guestNoticeText}>{error}</Text>
            </View>
          ) : null}

          {data && !data.featuredMatch && !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t("home.noMatches")}</Text>
            </View>
          ) : null}

          {data?.featuredMatch ? (
            <FeaturedMatchCard
              match={data.featuredMatch}
              obscureStats={obscureStats}
              onOpenCalendar={() => router.push("/matches")}
              onPress={() =>
                openMatch(
                  data.featuredMatch!.id,
                  data.featuredMatch!.homeTeamName,
                  data.featuredMatch!.awayTeamName,
                  data.featuredMatch!.competitionName,
                  data.featuredMatch!.homeTeamId,
                  data.featuredMatch!.awayTeamId
                )
              }
            />
          ) : null}

          <MatchRadarHomeCta />
          <RefereeSeverityHomeCta />

          <UpcomingMatchesSection
            matches={upcomingMatches}
            onSeeAll={() => router.push("/matches")}
            onMatchPress={openUpcoming}
          />

          {lastRefreshClock ? (
            <View style={styles.lastRefresh}>
              <Ionicons name="refresh-outline" size={12} color={homeColors.green} />
              <Text style={styles.lastRefreshText}>{t("common.updatedAt", { time: lastRefreshClock })}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <PitchBrainLoading visible={firstLoad} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: homeColors.bg
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center"
  },
  content: {
    gap: spacing.md
  },
  guestNotice: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  guestNoticeText: {
    color: homeColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },
  emptyBox: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  emptyText: {
    color: homeColors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  },
  lastRefresh: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
    paddingBottom: 8
  },
  lastRefreshText: {
    color: homeColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6
  }
});
