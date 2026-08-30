import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { AnalysisOptionCard } from "@/components/analysis/AnalysisOptionCard";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { RemainingUnlocksIndicator } from "@/components/entitlements/EntitlementGates";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { genericTeamColor } from "@/lib/match-display";
import { matchChildHref, useMatchRouteParams } from "@/lib/matches/use-match-route-params";
import { spacing } from "@/lib/theme";

export default function MatchHubScreen() {
  const router = useRouter();
  const match = useMatchRouteParams();
  const { isPro } = useEntitlements();
  const homeColor = genericTeamColor(match.homeName);
  const awayColor = genericTeamColor(match.awayName);

  const open = (screen: "fouls" | "performance" | "prematch") => {
    router.push(matchChildHref(match.eventId, screen, match.params));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AnalysisNavHeader backLabel="Analisi Partita" />

        <Text style={styles.competition}>{match.competitionName.toUpperCase()}</Text>
        {match.kickoffLabel ? <Text style={styles.kickoff}>{match.kickoffLabel}</Text> : null}

        <View style={styles.teams}>
          <View style={styles.teamCol}>
            <View style={[styles.avatar, { borderColor: `${homeColor}88` }]}>
              <Text style={[styles.avatarText, { color: homeColor }]}>{match.homeInitials}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {match.homeName}
            </Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.teamCol}>
            <View style={[styles.avatar, { borderColor: `${awayColor}88` }]}>
              <Text style={[styles.avatarText, { color: awayColor }]}>{match.awayInitials}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={2}>
              {match.awayName}
            </Text>
          </View>
        </View>

        {!isPro ? <RemainingUnlocksIndicator /> : null}

        <View style={styles.cards}>
          <AnalysisOptionCard
            title="Scontri & Falli"
            description="Aggressività, falli e duelli individuali"
            onPress={() => open("fouls")}
          />
          <AnalysisOptionCard
            title="Player Performance"
            description="Pericolosità, tiro, creazione e rendimento"
            onPress={() => open("performance")}
          />
          <AnalysisOptionCard
            title="Pre-Partita"
            description="Ritmo, forma, equilibrio e chiavi tattiche"
            onPress={() => open("prematch")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: analysisColors.bg
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  competition: {
    color: analysisColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1
  },
  kickoff: {
    marginTop: -8,
    color: analysisColors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  teams: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    minWidth: 0
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    backgroundColor: analysisColors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800"
  },
  teamName: {
    color: analysisColors.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  },
  vs: {
    color: analysisColors.green,
    fontSize: 16,
    fontWeight: "800"
  },
  cards: {
    gap: 12,
    marginTop: 8
  }
});
