import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { AlertCreator } from "@/components/live-alerts/AlertCreator";
import { AlertManager } from "@/components/live-alerts/AlertManager";
import { homeColors } from "@/components/home/home-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { cancelLiveAlert, createLiveAlert, fetchLiveHubDetail, heartbeatLiveMatch } from "@/lib/live-alerts/api";
import type { LiveHubDetail } from "@/lib/live-alerts/types";
import { spacing } from "@/lib/theme";

export default function LiveMatchDetailScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ eventId?: string; home?: string; away?: string }>();
  const eventId = Number(params.eventId);
  const [detail, setDetail] = useState<LiveHubDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    try {
      setDetail(await fetchLiveHubDetail(eventId));
    } catch {
      setDetail(null);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session || !Number.isFinite(eventId)) return;
    void heartbeatLiveMatch(eventId).catch(() => undefined);
    const timer = setInterval(() => {
      void heartbeatLiveMatch(eventId).catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  }, [eventId, session]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AnalysisNavHeader backLabel={t("liveAlerts.title")} />
        <Text style={styles.score}>
          {detail?.match.homeTeamName ?? params.home} {detail?.match.homeScore ?? 0} - {detail?.match.awayScore ?? 0}{" "}
          {detail?.match.awayTeamName ?? params.away}
        </Text>
        <Text style={styles.meta}>
          {t("liveAlerts.minute")} {detail?.match.minute ?? "-"}
        </Text>

        {!session ? (
          <Pressable onPress={() => router.push("/login")} style={styles.cta}>
            <Text style={styles.ctaText}>{t("liveAlerts.loginRequired")}</Text>
          </Pressable>
        ) : creating && detail ? (
          <AlertCreator
            detail={detail}
            onClose={() => setCreating(false)}
            onSubmit={async (input) => {
              await createLiveAlert({
                fixtureId: eventId,
                ...input,
                locale
              });
              setCreating(false);
              await load();
            }}
          />
        ) : (
          <Pressable onPress={() => setCreating(true)} style={styles.cta}>
            <Text style={styles.ctaText}>🔔 {t("liveAlerts.create")}</Text>
          </Pressable>
        )}

        <View style={styles.block}>
          <AlertManager
            alerts={detail?.alerts ?? []}
            onCancel={async (id) => {
              await cancelLiveAlert(id);
              await load();
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: homeColors.bg },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  score: { color: homeColors.text, fontSize: 22, fontWeight: "800" },
  meta: { color: homeColors.green, fontWeight: "800" },
  cta: {
    backgroundColor: homeColors.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  ctaText: { color: homeColors.ctaText, fontWeight: "800", fontSize: 15 },
  block: { marginTop: spacing.sm }
});
