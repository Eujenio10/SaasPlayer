import { FOULS_ANALYSIS_UI } from "@/lib/fouls-analysis-ui-text";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnalysisMetricStrip } from "@/components/analysis/AnalysisMetricStrip";
import {
  GuestLockedSectionPanel,
  GuestObscuredDuelPlaceholder
} from "@/components/access/GuestLockedSectionPanel";
import { GuestPartialPreviewBanner } from "@/components/access/GuestPartialPreviewBanner";
import { SimplePlayerCard } from "@/components/analysis/SimplePlayerCard";
import { SimpleDuelCard } from "@/components/analysis/SimpleDuelCard";
import { analysisColors } from "@/components/analysis/analysis-theme";
import {
  buildMatchIntensityAnalysis,
  FOULS_PROFILE_MIN_AVG,
  formatMetric,
  MATCH_MONITOR_DUELS_COUNT,
  type HighIntensityDuel,
  type IntensityLevel,
  type PlayerIntensityMetrics
} from "@/lib/intensity-analysis";
import { findTacticalMetric } from "@/lib/duel-heatmap";
import type { GuestPreviewMode } from "@/lib/access/guest-preview-mode";
import { roleLabelSingular } from "@/lib/italian-display";
import type { TacticalMetrics } from "@/lib/types";
import { spacing } from "@/lib/theme";
import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";

const reliabilityLabels = {
  low: "Bassa",
  medium: "Media",
  good: "Buona",
  high: "Alta"
} as const;

const GUEST_VISIBLE_DUELS_WITH_AD = 2;
const PREVIEW_PLAYERS = 3;
const PREVIEW_DUELS = 2;

function intensityLevelLabel(level: IntensityLevel): string {
  if (level === "very_high" || level === "high") return "Alta";
  if (level === "medium") return "Media";
  return "Bassa";
}

function renderPlayerCards(
  players: PlayerIntensityMetrics[],
  metricKey: "committed" | "suffered",
  metrics: TacticalMetrics[],
  badgeText: string
) {
  if (!players.length) {
    return <Text style={styles.muted}>Nessun profilo sopra {FOULS_PROFILE_MIN_AVG} di media.</Text>;
  }

  return players.map((player) => (
    <SimplePlayerCard
      key={`${metricKey}-${player.playerName}-${player.teamId}`}
      playerName={player.playerName}
      team={player.team}
      roleLabel={roleLabelSingular(player.roleLabel)}
      description={metricKey === "committed" ? player.aggressionProfile : player.contactExposure}
      metricValue={formatMetric(
        metricKey === "committed" ? player.foulsCommittedP90 : player.foulsSufferedP90
      )}
      metricLabel="falli p90"
      reliabilityLabel={reliabilityLabels[player.reliability]}
      badgeText={badgeText}
      tacticalMetric={findTacticalMetric(
        metrics,
        player.playerName,
        player.team,
        player.playerId
      )}
    />
  ));
}

function renderDuelCard(duel: HighIntensityDuel, index: number, metrics: TacticalMetrics[]) {
  return (
    <SimpleDuelCard
      key={`duel-${index}-${duel.playerA}-${duel.playerB}`}
      playerA={duel.playerA}
      playerB={duel.playerB}
      teamA={duel.teamA}
      teamB={duel.teamB}
      playerAId={duel.playerAId}
      playerBId={duel.playerBId}
      roles={duel.zoneLabel}
      intensityLabel={formatMetric(duel.duelScore, 1)}
      reading={duel.reading}
      metrics={metrics}
    />
  );
}

function ExpandCta({
  expanded,
  expandLabel,
  collapseLabel,
  onPress
}: {
  expanded: boolean;
  expandLabel: string;
  collapseLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.ctaText}>{expanded ? collapseLabel : expandLabel}</Text>
    </Pressable>
  );
}

export function IntensityAnalysisView({
  metrics,
  homeTeamId,
  guestPreviewMode = "locked",
  guestFoulProfilesOnly = false,
  guestFeaturesPreviewActive = false,
  onWatchAd,
  onDiscoverPro
}: {
  metrics: TacticalMetrics[];
  homeTeamId?: number;
  guestPreviewMode?: GuestPreviewMode;
  guestFoulProfilesOnly?: boolean;
  guestFeaturesPreviewActive?: boolean;
  onWatchAd?: () => void;
  onDiscoverPro?: () => void;
}) {
  const analysis = useMemo(
    () => buildMatchIntensityAnalysis(metrics, { homeTeamId }),
    [metrics, homeTeamId]
  );
  const [showAllAggressive, setShowAllAggressive] = useState(false);
  const [showAllExposed, setShowAllExposed] = useState(false);
  const [showAllDuels, setShowAllDuels] = useState(false);

  const monitorDuels = analysis.highIntensityDuels.slice(0, MATCH_MONITOR_DUELS_COUNT);
  const previewMode = PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED ? guestPreviewMode : "full";
  const foulLock = PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && guestFoulProfilesOnly;
  const isGuest = foulLock || previewMode !== "full";
  const guestAdPreview = !foulLock && previewMode === "partial";

  const visibleAggressive = showAllAggressive
    ? analysis.aggressivePlayers
    : analysis.aggressivePlayers.slice(0, PREVIEW_PLAYERS);
  const visibleExposed = showAllExposed
    ? analysis.exposedPlayers
    : analysis.exposedPlayers.slice(0, PREVIEW_PLAYERS);
  const visibleDuels = showAllDuels ? monitorDuels : monitorDuels.slice(0, PREVIEW_DUELS);

  const duelsContentFull = monitorDuels.length ? (
    <View style={styles.stack}>
      {visibleDuels.map((duel, index) => renderDuelCard(duel, index, metrics))}
      {monitorDuels.length > PREVIEW_DUELS ? (
        <ExpandCta
          expanded={showAllDuels}
          expandLabel="Vedi duelli >"
          collapseLabel="Mostra meno"
          onPress={() => setShowAllDuels((open) => !open)}
        />
      ) : null}
    </View>
  ) : (
    <Text style={styles.muted}>Nessun duello rilevante con i dati attuali.</Text>
  );

  const duelsContentGuest = (() => {
    if (!monitorDuels.length) {
      return <Text style={styles.muted}>Nessun duello rilevante con i dati attuali.</Text>;
    }
    if (foulLock) {
      if (guestFeaturesPreviewActive) {
        return (
          <View style={styles.stack}>
            <Text style={styles.sectionHint}>
              Sblocco attivo — Duelli da monitorare disponibili per 15 minuti.
            </Text>
            {duelsContentFull}
          </View>
        );
      }
      return (
        <GuestLockedSectionPanel
          title="Duelli da monitorare"
          description={`${MATCH_MONITOR_DUELS_COUNT} duelli fisici da monitorare per questa partita. Guarda una pubblicità per sbloccarli per 15 minuti.`}
          onWatchAd={onWatchAd}
          onDiscoverPro={onDiscoverPro}
          showAdCta
        />
      );
    }
    if (!guestAdPreview) {
      return (
        <GuestLockedSectionPanel
          title="Duelli da monitorare"
          description={`${MATCH_MONITOR_DUELS_COUNT} duelli fisici da monitorare per questa partita. Disponibile con PitchBrain Pro.`}
          onDiscoverPro={onDiscoverPro}
          showAdCta={false}
        />
      );
    }
    const previewDuels = monitorDuels.slice(0, GUEST_VISIBLE_DUELS_WITH_AD);
    return (
      <View style={styles.stack}>
        <Text style={styles.sectionHint}>
          Anteprima — {GUEST_VISIBLE_DUELS_WITH_AD} di {MATCH_MONITOR_DUELS_COUNT} duelli
        </Text>
        {previewDuels.map((duel, index) => renderDuelCard(duel, index, metrics))}
        {monitorDuels.slice(GUEST_VISIBLE_DUELS_WITH_AD).map((_, index) => (
          <GuestObscuredDuelPlaceholder
            key={`obscured-duel-${index}`}
            label={`Duello ${GUEST_VISIBLE_DUELS_WITH_AD + index + 1} riservato`}
          />
        ))}
        <GuestPartialPreviewBanner onDiscoverPro={onDiscoverPro} />
      </View>
    );
  })();

  if (!metrics.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{FOULS_ANALYSIS_UI.emptyState}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Profili falli</Text>
        {!foulLock ? (
          <AnalysisMetricStrip
            items={[
              {
                label: "Fisicità",
                value: intensityLevelLabel(analysis.matchIntensity.level),
                sublabel:
                  analysis.matchIntensity.value != null
                    ? formatMetric(analysis.matchIntensity.value)
                    : undefined
              },
              {
                label: "Affidabilità",
                value: reliabilityLabels[analysis.reliabilityOverview.level],
                sublabel: analysis.reliabilityOverview.level === "low" ? "Dati parziali" : undefined
              },
              {
                label: "Contesto",
                value: analysis.matchIntensity.level === "low" ? "Contenuto" : "Elevato",
                sublabel: analysis.matchIntensity.level === "low" ? "Zone mirate" : "Diffuso"
              }
            ]}
          />
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Giocatori aggressivi</Text>
        <Text style={styles.sectionHint}>
          Giocatori con media falli commessi &gt; {formatMetric(FOULS_PROFILE_MIN_AVG)}
        </Text>
        {renderPlayerCards(
          visibleAggressive,
          "committed",
          metrics,
          "Profilo falli commessi sopra soglia"
        )}
        {analysis.aggressivePlayers.length > PREVIEW_PLAYERS ? (
          <ExpandCta
            expanded={showAllAggressive}
            expandLabel="Vedi tutti >"
            collapseLabel="Mostra meno"
            onPress={() => setShowAllAggressive((open) => !open)}
          />
        ) : null}

        <Text style={[styles.sectionHint, styles.sectionGap]}>
          Giocatori con media falli subiti &gt; {formatMetric(FOULS_PROFILE_MIN_AVG)}
        </Text>
        {renderPlayerCards(
          visibleExposed,
          "suffered",
          metrics,
          "Profilo esposizione ai falli sopra soglia"
        )}
        {analysis.exposedPlayers.length > PREVIEW_PLAYERS ? (
          <ExpandCta
            expanded={showAllExposed}
            expandLabel="Vedi tutti >"
            collapseLabel="Mostra meno"
            onPress={() => setShowAllExposed((open) => !open)}
          />
        ) : null}
        {isGuest ? <GuestPartialPreviewBanner onDiscoverPro={onDiscoverPro} /> : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Duelli da monitorare</Text>
        {isGuest ? duelsContentGuest : duelsContentFull}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xl, gap: 20 },
  block: { gap: 10 },
  blockTitle: {
    color: analysisColors.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  stack: { gap: 10 },
  sectionHint: {
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  sectionGap: {
    marginTop: 8
  },
  muted: { color: analysisColors.textMuted, fontSize: 13, lineHeight: 18 },
  cta: {
    minHeight: 44,
    justifyContent: "center"
  },
  ctaText: {
    color: analysisColors.green,
    fontSize: 14,
    fontWeight: "800"
  },
  empty: { flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center" },
  emptyText: { color: analysisColors.textMuted, textAlign: "center" }
});
