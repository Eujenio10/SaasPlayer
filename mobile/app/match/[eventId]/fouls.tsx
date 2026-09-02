import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { IntensityAnalysisView } from "@/components/intensity/IntensityAnalysisView";
import { LockedContentPreview } from "@/components/entitlements/EntitlementGates";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { isGuestUser, resolveGuestPreviewMode } from "@/lib/access/guest-preview-mode";
import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { consumeMemberMatch, fetchMatchInsights } from "@/lib/api";
import { useMatchRouteParams } from "@/lib/matches/use-match-route-params";
import type { TacticalMetrics } from "@/lib/types";
import { spacing } from "@/lib/theme";
import { useLocale } from "@/contexts/LocaleContext";

function resolveHomeTeamId(metrics: TacticalMetrics[], homeName?: string): number | undefined {
  if (!homeName?.trim() || !metrics.length) return undefined;
  const normalized = homeName.trim().toLowerCase();
  const hit = metrics.find((m) => m.team.trim().toLowerCase() === normalized);
  return hit?.teamId;
}

export default function MatchFoulsScreen() {
  const match = useMatchRouteParams();
  const { t } = useLocale();
  const { access, userStatus, refreshAccess } = useAuth();
  const { openPaywall } = useAccessFlow();
  const { featuresPreviewActive, openAdModal } = useGuestPreview();
  const { isPro, isMatchUnlocked, canAccessFeature } = useEntitlements();
  const [metrics, setMetrics] = useState<TacticalMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUnlockedRef = useRef(false);
  const emptyRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eventId = match.eventId;
  const isGuest = isGuestUser(userStatus);
  const matchAnalysisUnlocked =
    isPro || isMatchUnlocked(eventId) || canAccessFeature("match_full_analysis", eventId);
  const guestPreviewMode = resolveGuestPreviewMode(userStatus, featuresPreviewActive, {
    contentUnlocked: matchAnalysisUnlocked
  });
  const analysisLocked = !matchAnalysisUnlocked;

  const openProPaywall = useCallback(() => {
    openPaywall("advancedMatchAnalysis", {
      type: "open_feature",
      feature: "advancedMatchAnalysis",
      matchId: eventId,
      returnTab: "intensity"
    });
  }, [eventId, openPaywall]);

  const homeTeamId = useMemo(() => {
    if (match.homeTeamId) return match.homeTeamId;
    return resolveHomeTeamId(metrics, match.params.home);
  }, [match.homeTeamId, match.params.home, metrics]);

  const load = useCallback(async () => {
    if (!Number.isFinite(eventId)) {
      setError(t("prematch.invalidMatch"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (access?.isMember) {
        void consumeMemberMatch(eventId)
          .then(() => refreshAccess())
          .catch(() => undefined);
      }

      const data = await fetchMatchInsights(eventId);
      const nextMetrics = data.metrics ?? [];
      setMetrics(nextMetrics);
      if (nextMetrics.length) {
        setError(null);
      } else {
        setError(MATCH_DATA_UNAVAILABLE_MESSAGE);
        if (emptyRetryTimer.current == null) {
          emptyRetryTimer.current = setTimeout(() => {
            emptyRetryTimer.current = null;
            void fetchMatchInsights(eventId)
              .then((retry) => {
                const retryMetrics = retry.metrics ?? [];
                setMetrics(retryMetrics);
                setError(retryMetrics.length ? null : MATCH_DATA_UNAVAILABLE_MESSAGE);
              })
              .catch(() => undefined);
          }, 4_000);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "public_access_unavailable"
          ? "Esplorazione Guest non disponibile: configura PITCHBRAIN_PUBLIC_ORG_ID sul server."
          : MATCH_DATA_UNAVAILABLE_MESSAGE
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, access?.isMember, refreshAccess]);

  useEffect(() => {
    void load();
    return () => {
      if (emptyRetryTimer.current) {
        clearTimeout(emptyRetryTimer.current);
        emptyRetryTimer.current = null;
      }
    };
  }, [load]);

  useEffect(
    () =>
      subscribeAdminCatalogRefresh(() => {
        if (!Number.isFinite(eventId)) return;
        void fetchMatchInsights(eventId)
          .then((data) => {
            setMetrics(data.metrics ?? []);
            if (!data.metrics?.length) setError(MATCH_DATA_UNAVAILABLE_MESSAGE);
            else setError(null);
          })
          .catch(() => undefined);
      }),
    [eventId]
  );

  useEffect(() => {
    if (matchAnalysisUnlocked && !prevUnlockedRef.current) {
      prevUnlockedRef.current = true;
      void load();
      return;
    }
    if (!matchAnalysisUnlocked) {
      prevUnlockedRef.current = false;
    }
  }, [matchAnalysisUnlocked, load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerPad}>
        <AnalysisNavHeader
          backLabel={t("matchHub.backMatch")}
          title={t("fouls.title")}
          subtitle={match.kickoffLongLabel}
        />
      </View>

      <View style={styles.body}>
        {!loading ? (
          <>
            {error ? (
              <>
                <Text style={styles.error}>{error}</Text>
                <Pressable onPress={() => void load()} style={styles.retryBtn}>
                  <Text style={styles.retryText}>{t("common.retry")}</Text>
                </Pressable>
              </>
            ) : null}

            {analysisLocked ? (
              <View style={styles.lockWrap}>
                <LockedContentPreview
                  title={t("entitlements.lockTitle")}
                  description={t("entitlements.lockBody")}
                  matchId={eventId}
                  sourceScreen="match_detail"
                />
              </View>
            ) : null}

            <IntensityAnalysisView
              metrics={metrics}
              homeTeamId={homeTeamId}
              guestPreviewMode={guestPreviewMode}
              guestFoulProfilesOnly={analysisLocked}
              guestFeaturesPreviewActive={(isGuest && featuresPreviewActive) || matchAnalysisUnlocked}
              onWatchAd={() => openAdModal("features")}
              onDiscoverPro={openProPaywall}
            />
          </>
        ) : null}
        <PitchBrainLoading visible={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  headerPad: { paddingHorizontal: spacing.md },
  body: { flex: 1, minHeight: 0, paddingHorizontal: spacing.md },
  retryBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  retryText: { color: analysisColors.green, fontSize: 14, fontWeight: "800" },
  error: { marginBottom: spacing.sm, color: "#F87171", fontSize: 13, lineHeight: 18 },
  lockWrap: { marginBottom: spacing.sm }
});
