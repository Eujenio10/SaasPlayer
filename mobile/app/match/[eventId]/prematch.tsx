import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { PreMatchReportView } from "@/components/prematch";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useMatchRouteParams } from "@/lib/matches/use-match-route-params";
import { spacing } from "@/lib/theme";

export default function MatchPrematchScreen() {
  const match = useMatchRouteParams();
  const { openPaywall } = useAccessFlow();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerPad}>
        <AnalysisNavHeader
          backLabel="Match"
          title="Pre-Partita"
          subtitle={match.kickoffLongLabel}
        />
      </View>
      <View style={styles.body}>
        <PreMatchReportView
          eventId={match.eventId}
          homeName={match.homeName}
          awayName={match.awayName}
          competition={match.competitionName}
          canAccess
          guestPreviewMode="full"
          onDiscoverPro={() =>
            openPaywall("fullPreMatchReport", {
              type: "open_feature",
              feature: "fullPreMatchReport",
              matchId: match.eventId,
              returnTab: "prematch"
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  headerPad: { paddingHorizontal: spacing.md },
  body: { flex: 1, minHeight: 0, paddingHorizontal: spacing.md }
});
