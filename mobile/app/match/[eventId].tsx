import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MatchAnalysisTabs, type MatchAnalysisTab } from "@/components/analysis/MatchAnalysisTabs";
import { PreMatchReportView } from "@/components/prematch";
import { TeamFormSignalsView } from "@/components/team-form-signals";
import { IntensityAnalysisView } from "@/components/intensity/IntensityAnalysisView";
import { PlayerPerformanceView } from "@/components/player-performance/PlayerPerformanceView";
import {
  LockedContentPreview,
  RemainingUnlocksIndicator
} from "@/components/entitlements/EntitlementGates";
import { Screen } from "@/components/Screen";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { canAccessFeatureId } from "@/lib/access/features";
import { isGuestUser, resolveGuestPreviewMode } from "@/lib/access/guest-preview-mode";
import type { TeamFormSignalsReport } from "@/lib/team-form-signals/types";
import { consumeMemberMatch, fetchMatchInsights } from "@/lib/api";
import { translateCompetitionName, translateTeamName } from "@/lib/italian-display";
import type { TacticalMetrics } from "@/lib/types";
import { colors, spacing } from "@/lib/theme";

function resolveHomeTeamId(metrics: TacticalMetrics[], homeName?: string): number | undefined {
  if (!homeName?.trim() || !metrics.length) return undefined;
  const normalized = homeName.trim().toLowerCase();
  const hit = metrics.find((m) => m.team.trim().toLowerCase() === normalized);
  return hit?.teamId;
}

export default function MatchDetailScreen() {
  const params = useLocalSearchParams<{
    eventId: string;
    home?: string;
    away?: string;
    competition?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    startTimestamp?: string;
  }>();
  const eventId = Number(params.eventId);
  const { access, userStatus, refreshAccess } = useAuth();
  const { requestFeature, openPaywall } = useAccessFlow();
  const { featuresPreviewActive, openAdModal } = useGuestPreview();
  const { isPro, isMatchUnlocked, canAccessFeature } = useEntitlements();
  const [metrics, setMetrics] = useState<TacticalMetrics[]>([]);
  const [teamFormSignals, setTeamFormSignals] = useState<TeamFormSignalsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MatchAnalysisTab>("intensity");
  const prevUnlockedRef = useRef(false);

  const isGuest = isGuestUser(userStatus);
  const canAccessPreMatch = canAccessFeatureId(userStatus, "fullPreMatchReport");
  const matchAnalysisUnlocked =
    isPro || isMatchUnlocked(eventId) || canAccessFeature("match_full_analysis", eventId);
  const showTeamFormFullDetail =
    matchAnalysisUnlocked ||
    isGuest ||
    userStatus === "authenticated_pro" ||
    Boolean(access?.isPro) ||
    Boolean(access?.isAdmin);
  const guestPreviewMode = resolveGuestPreviewMode(userStatus, featuresPreviewActive);

  const openProPaywall = useCallback(() => {
    openPaywall("advancedMatchAnalysis", {
      type: "open_feature",
      feature: "advancedMatchAnalysis",
      matchId: eventId,
      returnTab: tab
    });
  }, [eventId, openPaywall, tab]);

  const startTimestamp = useMemo(() => {
    const value = Number(params.startTimestamp);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.startTimestamp]);

  const homeTeamId = useMemo(() => {
    const fromParams = Number(params.homeTeamId);
    if (Number.isFinite(fromParams) && fromParams > 0) return fromParams;
    return resolveHomeTeamId(metrics, params.home);
  }, [metrics, params.home, params.homeTeamId]);

  const load = useCallback(async () => {
    if (!Number.isFinite(eventId)) {
      setError("Partita non valida.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (access?.isMember) {
        await consumeMemberMatch(eventId).catch(() => undefined);
        await refreshAccess();
      }

      const data = await fetchMatchInsights(eventId);
      setMetrics(data.metrics ?? []);
      setTeamFormSignals(data.teamFormSignals ?? null);
      if (!data.metrics?.length && !data.teamFormSignals) {
        setError(
          matchAnalysisUnlocked
            ? "Analisi ancora in preparazione per questa partita. Riprova tra poco oppure chiedi all'admin di aggiornare i dati."
            : "Nessun insight disponibile per questa partita."
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "public_access_unavailable"
          ? "Esplorazione Guest non disponibile: configura PITCHBRAIN_PUBLIC_ORG_ID sul server."
          : "Impossibile caricare l'analisi."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, access?.isMember, refreshAccess, matchAnalysisUnlocked]);

  useEffect(() => {
    void load();
  }, [load]);

  // Dopo lo sblocco rADS i tab Intensity/Forma dipendono dagli insight: ricarica subito.
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

  const handleTabChange = (next: MatchAnalysisTab) => {
    if (next === "prematch" && userStatus !== "guest") {
      const allowed = requestFeature("fullPreMatchReport", {
        type: "open_feature",
        feature: "fullPreMatchReport",
        matchId: eventId,
        returnTab: "prematch"
      });
      if (!allowed) return;
    }
    setTab(next);
  };

  const homeDisplay = translateTeamName(params.home ?? "");
  const awayDisplay = translateTeamName(params.away ?? "");
  const competitionDisplay = translateCompetitionName(params.competition ?? "Competizione");

  const title =
    homeDisplay && awayDisplay
      ? `${homeDisplay} vs ${awayDisplay}`
      : `Partita #${params.eventId}`;

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Text style={styles.competition}>{competitionDisplay}</Text>
      <Text style={styles.title}>{title}</Text>
      {!isPro ? <RemainingUnlocksIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!matchAnalysisUnlocked ? (
        <View style={styles.lockWrap}>
          <LockedContentPreview
            title="Analisi completa della partita"
            description="Anteprima Free: un duello principale, un giocatore pericoloso e un'indicazione sul gioco delle due squadre. Sblocca con un video l'analisi completa di questa sola partita."
            matchId={eventId}
            sourceScreen="match_detail"
          />
        </View>
      ) : null}

      <MatchAnalysisTabs active={tab} onChange={handleTabChange} isGuest={isGuest} />

      <View style={styles.tabContent}>
        {tab === "intensity" ? (
          <IntensityAnalysisView
            metrics={metrics}
            homeTeamId={homeTeamId}
            guestFoulProfilesOnly={isGuest && !matchAnalysisUnlocked}
            guestFeaturesPreviewActive={featuresPreviewActive || matchAnalysisUnlocked}
            onWatchAd={() => openAdModal("features")}
            onDiscoverPro={openProPaywall}
          />
        ) : tab === "teamForm" ? (
          <TeamFormSignalsView
            report={teamFormSignals}
            showFullDetail={showTeamFormFullDetail}
            onWatchAd={openAdModal}
            onDiscoverPro={openProPaywall}
            onRefresh={() => void load()}
          />
        ) : tab === "playerPerformance" ? (
          matchAnalysisUnlocked ? (
            <PlayerPerformanceView
              eventId={eventId}
              homeTeamId={homeTeamId}
              awayTeamId={Number(params.awayTeamId) > 0 ? Number(params.awayTeamId) : undefined}
              homeTeamName={params.home}
              awayTeamName={params.away}
              startTimestamp={startTimestamp}
            />
          ) : (
            <LockedContentPreview
              title="Player Performance"
              description="Sblocca l'analisi completa per vedere i giocatori più pericolosi nei tiri e nell'uno contro uno."
              matchId={eventId}
              sourceScreen="player_performance"
            />
          )
        ) : (
          <PreMatchReportView
            eventId={eventId}
            homeName={homeDisplay || params.home}
            awayName={awayDisplay || params.away}
            competition={competitionDisplay}
            canAccess={canAccessPreMatch}
            guestPreviewMode={isGuest ? "locked" : guestPreviewMode}
            onDiscoverPro={openProPaywall}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  competition: {
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  title: {
    marginTop: 4,
    marginBottom: spacing.sm,
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  error: {
    marginBottom: spacing.sm,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18
  },
  lockWrap: {
    marginBottom: spacing.sm
  },
  tabContent: { flex: 1, minHeight: 0 }
});
