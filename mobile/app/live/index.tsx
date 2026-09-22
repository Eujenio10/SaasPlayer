import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { LiveMatchHub } from "@/components/live-alerts/LiveMatchHub";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchLiveHubMatches } from "@/lib/live-alerts/api";
import type { LiveHubMatch } from "@/lib/live-alerts/types";
import { useFocusEffect } from "expo-router";
import { spacing } from "@/lib/theme";

export default function LiveAlertsIndexScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const [matches, setMatches] = useState<LiveHubMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMatches(await fetchLiveHubMatches());
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={homeColors.green} />}
      >
        <AnalysisNavHeader backLabel={t("matches.back")} />
        <Text style={styles.title}>{t("liveAlerts.title")}</Text>
        <Text style={styles.subtitle}>{t("liveAlerts.subtitle")}</Text>
        <LiveMatchHub
          matches={matches}
          onOpen={(match) =>
            router.push({
              pathname: "/live/[eventId]",
              params: {
                eventId: String(match.eventId),
                home: match.homeTeamName,
                away: match.awayTeamName
              }
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homeColors.bg },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  title: { color: homeColors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: homeColors.textMuted, fontSize: 14, lineHeight: 20 }
});
