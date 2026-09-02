import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { PlayerPerformanceView } from "@/components/player-performance/PlayerPerformanceView";
import { LockedContentPreview } from "@/components/entitlements/EntitlementGates";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { useMatchRouteParams } from "@/lib/matches/use-match-route-params";
import { spacing } from "@/lib/theme";
import { useLocale } from "@/contexts/LocaleContext";
import { translateCompetitionName } from "@/lib/i18n";

export default function MatchPerformanceScreen() {
  const match = useMatchRouteParams();
  const { t } = useLocale();
  const { isPro, isMatchUnlocked, canAccessFeature } = useEntitlements();
  const matchAnalysisUnlocked =
    isPro ||
    isMatchUnlocked(match.eventId) ||
    canAccessFeature("match_full_analysis", match.eventId);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerPad}>
        <AnalysisNavHeader
          backLabel={t("matchHub.backMatch")}
          title={t("matchHub.performanceTitle")}
          subtitle={`${match.homeInitials} vs ${match.awayInitials} · ${translateCompetitionName(match.competitionName)}`}
        />
      </View>
      <View style={styles.body}>
        {matchAnalysisUnlocked ? (
          <PlayerPerformanceView
            eventId={match.eventId}
            homeTeamId={match.homeTeamId}
            awayTeamId={match.awayTeamId}
            homeTeamName={match.params.home}
            awayTeamName={match.params.away}
            startTimestamp={match.startTimestamp}
          />
        ) : (
          <LockedContentPreview
            title={t("matchHub.performanceTitle")}
            description={t("entitlements.performanceLock")}
            matchId={match.eventId}
            sourceScreen="player_performance"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  headerPad: { paddingHorizontal: spacing.md },
  body: { flex: 1, minHeight: 0, paddingHorizontal: spacing.md }
});
