import { FOULS_ANALYSIS_UI } from "@/lib/fouls-analysis-ui-text";

import { useMemo } from "react";

import { StyleSheet, Text, View } from "react-native";

import { AnalysisMetricStrip } from "@/components/analysis/AnalysisMetricStrip";

import { AnalysisSectionPager, type AnalysisSection } from "@/components/analysis/AnalysisSectionPager";

import {

  GuestLockedSectionPanel,

  GuestObscuredDuelPlaceholder

} from "@/components/access/GuestLockedSectionPanel";

import { GuestPartialPreviewBanner } from "@/components/access/GuestPartialPreviewBanner";

import { SimplePlayerCard } from "@/components/analysis/SimplePlayerCard";

import { SimpleDuelCard } from "@/components/analysis/SimpleDuelCard";

import { SimpleZoneRow } from "@/components/analysis/SimpleZoneRow";

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

import { colors, spacing } from "@/lib/theme";



const reliabilityLabels = {

  low: "BASSA",

  medium: "MEDIA",

  good: "BUONA",

  high: "ALTA"

} as const;



const GUEST_VISIBLE_DUELS_WITH_AD = 2;



function intensityLevelLabel(level: IntensityLevel): string {

  if (level === "very_high" || level === "high") return "ALTA";

  if (level === "medium") return "MEDIA";

  return "BASSA";

}



function zoneIcon(zoneId: string): "locate-outline" | "radio-button-on-outline" | "shield-outline" {

  if (zoneId.includes("final") || zoneId.includes("offensive")) return "locate-outline";

  if (zoneId.includes("mid")) return "radio-button-on-outline";

  return "shield-outline";

}



function renderPlayerCards(

  players: PlayerIntensityMetrics[],

  metricKey: "committed" | "suffered",

  metrics: TacticalMetrics[],

  badgeIcon: "body-outline" | "flash-outline",

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

      metricLabel={metricKey === "committed" ? "falli commessi p90" : "falli subiti p90"}

      reliabilityLabel={reliabilityLabels[player.reliability]}

      badgeIcon={badgeIcon}

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

      intensityLabel={`Scontro ${formatMetric(duel.duelScore, 1)}`}

      reading={duel.reading}

      metrics={metrics}

    />

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



  const monitorDuels = analysis.highIntensityDuels.slice(0, MATCH_MONITOR_DUELS_COUNT);

  const isGuest = guestFoulProfilesOnly || guestPreviewMode !== "full";

  const guestAdPreview = !guestFoulProfilesOnly && guestPreviewMode === "partial";



  const sections = useMemo((): AnalysisSection[] => {

    const summaryStrip = (

      <AnalysisMetricStrip

        items={[

          {

            icon: "speedometer-outline",

            label: FOULS_ANALYSIS_UI.metricLabel,

            value: analysis.matchIntensity.value != null ? formatMetric(analysis.matchIntensity.value) : "—",

            sublabel: intensityLevelLabel(analysis.matchIntensity.level)

          },

          {

            icon: "shield-checkmark-outline",

            iconColor: colors.amber,

            label: "Affidabilità",

            value: reliabilityLabels[analysis.reliabilityOverview.level],

            sublabel: analysis.reliabilityOverview.level === "low" ? "Dati parziali" : undefined

          },

          {

            icon: "analytics-outline",

            iconColor: "#A78BFA",

            label: "Contesto",

            value: analysis.matchIntensity.level === "low" ? "Contenuto" : "Elevato",

            sublabel: analysis.matchIntensity.level === "low" ? "Zone mirate" : "Diffuso"

          }

        ]}

      />

    );



    const profilesContent = (

      <View style={styles.stack}>

        {!guestFoulProfilesOnly ? summaryStrip : null}

        <Text style={styles.sectionHint}>

          Giocatori con media falli commessi &gt; {formatMetric(FOULS_PROFILE_MIN_AVG)}

        </Text>

        {renderPlayerCards(

          analysis.aggressivePlayers,

          "committed",

          metrics,

          "body-outline",

          "Profilo falli commessi sopra soglia"

        )}

        <Text style={[styles.sectionHint, styles.sectionGap]}>

          Giocatori con media falli subiti &gt; {formatMetric(FOULS_PROFILE_MIN_AVG)}

        </Text>

        {renderPlayerCards(

          analysis.exposedPlayers,

          "suffered",

          metrics,

          "flash-outline",

          "Profilo esposizione ai falli sopra soglia"

        )}

        {isGuest ? (

          <GuestPartialPreviewBanner onDiscoverPro={onDiscoverPro} />

        ) : null}

      </View>

    );



    const duelsContentFull = monitorDuels.length ? (

      monitorDuels.map((duel, index) => renderDuelCard(duel, index, metrics))

    ) : (

      <Text style={styles.muted}>Nessun duello rilevante con i dati attuali.</Text>

    );



    const duelsContentGuest = (() => {

      if (!monitorDuels.length) {

        return <Text style={styles.muted}>Nessun duello rilevante con i dati attuali.</Text>;

      }

      if (guestFoulProfilesOnly) {
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

      return (

        <View style={styles.stack}>

          <Text style={styles.sectionHint}>

            Anteprima — {GUEST_VISIBLE_DUELS_WITH_AD} di {MATCH_MONITOR_DUELS_COUNT} duelli

          </Text>

          {monitorDuels.slice(0, GUEST_VISIBLE_DUELS_WITH_AD).map((duel, index) =>

            renderDuelCard(duel, index, metrics)

          )}

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



    const lockedGuestPanel = (title: string, description: string) => (

      <GuestLockedSectionPanel

        title={title}

        description={description}

        onWatchAd={onWatchAd}

        onDiscoverPro={onDiscoverPro}

        showAdCta={false}

      />

    );



    const list: AnalysisSection[] = [

      {

        id: "profiles",

        title: "Profili falli",

        content: profilesContent

      },

      {

        id: "duels",

        title: "Duelli da monitorare",

        content: isGuest ? duelsContentGuest : duelsContentFull

      },

      {

        id: "zones",

        title: "Zone di pressione",

        content: isGuest ? (

          lockedGuestPanel(

            "Zone di pressione",

            "Mappa delle zone con maggiore densità di contatti e falli: disponibile con PitchBrain Pro."

          )

        ) : analysis.pressureZones.length ? (

          analysis.pressureZones.map((zone) => (

            <SimpleZoneRow

              key={zone.zoneId}

              icon={zoneIcon(zone.zoneId)}

              label={zone.zoneLabel}

              level={zone.intensityLevel}

            />

          ))

        ) : (

          <Text style={styles.muted}>Zone non stimabili senza codici posizione.</Text>

        )

      }

    ];



    if (analysis.trendAvailable) {

      list.push({

        id: "trend",

        title: "Trend recente",

        content: isGuest ? (

          lockedGuestPanel(

            "Trend recente",

            "Andamento falli nelle ultime partite: sezione riservata agli account Pro."

          )

        ) : (

          <View style={styles.bulletList}>

            {analysis.aggressivePlayers.slice(0, 4).map((player) => (

              <Text key={`trend-${player.playerName}`} style={styles.bullet}>

                • {player.playerName}: {player.trendNote}

              </Text>

            ))}

          </View>

        )

      });

    }



    list.push({

      id: "summary",

      title: "Sintesi tecnica",

      content: isGuest ? (

        lockedGuestPanel(

          "Sintesi tecnica",

          "Lettura complessiva su falli e contatti di gara: disponibile con PitchBrain Pro."

        )

      ) : (

        <Text style={styles.summary}>{analysis.technicalSummary}</Text>

      )

    });



    if (guestFoulProfilesOnly) {

      return list.filter((section) => section.id !== "summary");

    }



    return list;

  }, [

    analysis,

    guestAdPreview,

    guestFoulProfilesOnly,

    guestFeaturesPreviewActive,

    isGuest,

    metrics,

    monitorDuels,

    onDiscoverPro,

    onWatchAd

  ]);



  if (!metrics.length) {

    return (

      <View style={styles.empty}>

        <Text style={styles.emptyText}>{FOULS_ANALYSIS_UI.emptyState}</Text>

      </View>

    );

  }



  return <AnalysisSectionPager sections={sections} />;

}



const styles = StyleSheet.create({

  stack: { gap: spacing.sm },

  sectionHint: {

    color: colors.text,

    fontSize: 14,

    fontWeight: "800"

  },

  sectionGap: {

    marginTop: spacing.sm

  },

  muted: { color: colors.textDim, fontSize: 13, lineHeight: 18 },

  bulletList: { gap: spacing.sm },

  bullet: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },

  summary: { color: colors.text, fontSize: 13, lineHeight: 20 },

  empty: { flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center" },

  emptyText: { color: colors.textDim, textAlign: "center" }

});


