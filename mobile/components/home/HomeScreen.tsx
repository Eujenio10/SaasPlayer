import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ErrorState } from "@/components/home/ErrorState";
import { FeaturedMatchCard } from "@/components/home/FeaturedMatchCard";
import { GuestHomePromoCard } from "@/components/home/GuestHomePromoCard";
import { HomeLoadingSkeleton } from "@/components/home/LoadingSkeleton";
import { ProUpsellCard } from "@/components/home/ProUpsellCard";
import { QuickActionsRow } from "@/components/home/QuickActionButton";
import { AnalyticsModuleCard } from "@/components/home/AnalyticsModuleCard";
import { MatchRadarHomeCta } from "@/components/match-radar/MatchRadarHomeCta";
import { DataRefreshScheduleBanner } from "@/components/home/DataRefreshScheduleBanner";
import { EarlySeasonNoticeBanner } from "@/components/home/EarlySeasonNoticeBanner";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { shouldObscureGuestStats } from "@/lib/access/guest-preview-mode";
import { useHomeDashboard } from "@/lib/home-dashboard/useHomeDashboard";
import { useAdminMatchesRefresh } from "@/lib/matches/useAdminMatchesRefresh";
import { colors, radii, spacing } from "@/lib/theme";

export function HomeScreen() {
  const router = useRouter();
  const { access, userStatus } = useAuth();
  const { openPaywall } = useAccessFlow();
  const { previewActive, openAdModal } = useGuestPreview();
  const { data, loading, error, refetch } = useHomeDashboard();
  const adminRefresh = useAdminMatchesRefresh(() => void refetch());

  const isGuest = userStatus === "guest";
  const obscureStats = shouldObscureGuestStats(userStatus, previewActive);
  const showProUpsell = userStatus !== "authenticated_pro";

  const openFeatured = (
    eventId: number,
    home: string,
    away: string,
    competition: string,
    homeTeamId: number,
    awayTeamId: number
  ) => {
    router.push({
      pathname: "/match/[eventId]",
      params: {
        eventId: String(eventId),
        home,
        away,
        competition,
        homeTeamId: String(homeTeamId),
        awayTeamId: String(awayTeamId)
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && !!data} onRefresh={() => void refetch()} tintColor={colors.cyan} />
        }
      >
        <HomeHeader
          role={data?.user.role ?? access?.role}
          isPro={userStatus === "authenticated_pro"}
          isGuest={isGuest}
          onAdminRefresh={access?.canRefreshData ? () => void adminRefresh.refresh() : undefined}
          adminRefreshing={adminRefresh.refreshing}
        />

        {loading && !data ? <HomeLoadingSkeleton /> : null}

        <View style={styles.content}>
          <EarlySeasonNoticeBanner message={data?.earlySeasonNotice} />
          <DataRefreshScheduleBanner status={data?.dataRefresh} />
          <MatchRadarHomeCta />

          {isGuest ? (
            <GuestHomePromoCard
              previewActive={previewActive}
              onDiscoverPro={() => openPaywall("fullPreMatchReport")}
              onWatchAd={openAdModal}
            />
          ) : null}

          {error && !data && !isGuest ? (
            <ErrorState message={error} onRetry={() => void refetch()} />
          ) : null}

          {error && !data && isGuest ? (
            <View style={styles.guestNotice}>
              <Text style={styles.guestNoticeText}>{error}</Text>
            </View>
          ) : null}

          {data?.featuredMatch ? (
            <FeaturedMatchCard
              match={data.featuredMatch}
              obscureStats={obscureStats}
              onPress={() =>
                openFeatured(
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

          {data?.quickActions?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Accesso rapido</Text>
              <QuickActionsRow
                actions={data.quickActions}
                onActionPress={(route) => router.push(route as Href)}
              />
            </View>
          ) : null}

          {data?.modules?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Moduli analitici</Text>
              {data.modules.map((module) => (
                <AnalyticsModuleCard
                  key={module.id}
                  module={module}
                  onPress={() => router.push(module.route as Href)}
                />
              ))}
            </View>
          ) : null}

          {showProUpsell && !isGuest ? (
            <ProUpsellCard onPress={() => openPaywall("fullPreMatchReport")} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl
  },
  content: {
    gap: spacing.lg
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  guestNotice: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.18)",
    backgroundColor: "rgba(56,189,248,0.06)"
  },
  guestNoticeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  }
});
