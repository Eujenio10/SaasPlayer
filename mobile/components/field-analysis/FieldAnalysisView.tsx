import { useMemo } from "react";

import { StyleSheet, Text, View } from "react-native";

import { AnalysisSectionPager, type AnalysisSection } from "@/components/analysis/AnalysisSectionPager";

import { FieldPitchZones } from "@/components/analysis/FieldPitchZones";

import { SimpleDuelCard } from "@/components/analysis/SimpleDuelCard";

import { SimpleZoneRow } from "@/components/analysis/SimpleZoneRow";

import { buildFieldAnalysisParams } from "@/lib/field-analysis/adapter";

import { generateFieldAnalysis } from "@/lib/field-analysis/fieldAnalysis";

import type { FieldInsight, SetPieceStats } from "@/lib/field-analysis/fieldAnalysis.types";

import {

  buildMatchIntensityAnalysis,

  formatMetric,

  MATCH_MONITOR_DUELS_COUNT

} from "@/lib/intensity-analysis";

import type { TacticalMetrics } from "@/lib/types";

import { colors, radii, spacing } from "@/lib/theme";



const DANGEROUS_ZONES = new Set(["box", "right_flank", "left_flank", "central"]);



const zonePitchLabels: Record<string, { id: string; label: string; color: string }> = {

  box: { id: "01", label: "Area di rigore", color: colors.rose },

  right_flank: { id: "02", label: "Fascia destra", color: colors.emerald },

  left_flank: { id: "03", label: "Fascia sinistra", color: colors.cyan },

  central: { id: "04", label: "Centrocampo", color: "#A78BFA" }

};



function formatStat(value: number | undefined): string {

  if (value == null || !Number.isFinite(value)) return "—";

  return formatMetric(value, value >= 10 ? 1 : 2);

}



function SetPieceTeamRow({

  teamName,

  stats

}: {

  teamName: string;

  stats?: SetPieceStats;

}) {

  if (!stats) return null;

  return (

    <View style={styles.statBlock}>

      <Text style={styles.statTeam}>{teamName}</Text>

      <View style={styles.statGrid}>

        <StatChip label="Corner" value={formatStat(stats.cornersFor)} />

        <StatChip label="Tiri da fermo" value={formatStat(stats.shotsFromSetPiecesFor)} />

        <StatChip label="xG da fermo" value={formatStat(stats.xgFromSetPiecesFor)} />

        <StatChip label="Punizioni zona alta" value={formatStat(stats.freeKicksWonFinalThird)} />

      </View>

    </View>

  );

}



function StatChip({ label, value }: { label: string; value: string }) {

  return (

    <View style={styles.statChip}>

      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statLabel}>{label}</Text>

    </View>

  );

}



function InsightCards({ insights }: { insights: FieldInsight[] }) {

  if (!insights.length) {

    return <Text style={styles.muted}>Lettura non disponibile con i dati attuali.</Text>;

  }

  return insights.map((insight) => (

    <View key={insight.id} style={styles.insightCard}>

      <Text style={styles.insightTitle}>{insight.title}</Text>

      <Text style={styles.insightText}>{insight.tacticalMeaning}</Text>

    </View>

  ));

}



export function FieldAnalysisView({

  metrics,

  eventId,

  homeTeamId,

  homeName,

  awayName,

  competition

}: {

  metrics: TacticalMetrics[];

  eventId: number;

  homeTeamId?: number;

  homeName?: string;

  awayName?: string;

  competition?: string;

}) {

  const adapted = useMemo(

    () =>

      buildFieldAnalysisParams({

        metrics,

        eventId,

        homeTeamId,

        homeName,

        awayName,

        competitionId: competition

      }),

    [metrics, eventId, homeTeamId, homeName, awayName, competition]

  );



  const fieldAnalysis = useMemo(() => {

    if (!adapted) return null;

    return generateFieldAnalysis(adapted.params);

  }, [adapted]);



  const intensityAnalysis = useMemo(

    () => buildMatchIntensityAnalysis(metrics, { homeTeamId }),

    [metrics, homeTeamId]

  );



  const monitorDuels = intensityAnalysis.highIntensityDuels.slice(0, MATCH_MONITOR_DUELS_COUNT);



  const setPieceInsights = useMemo(

    () => fieldAnalysis?.insights.filter((i) => i.fieldZone === "set_pieces") ?? [],

    [fieldAnalysis]

  );



  const dangerousInsights = useMemo(

    () => fieldAnalysis?.insights.filter((i) => i.fieldZone && DANGEROUS_ZONES.has(i.fieldZone)) ?? [],

    [fieldAnalysis]

  );



  const otherInsights = useMemo(

    () =>

      fieldAnalysis?.insights.filter(

        (i) => i.fieldZone !== "set_pieces" && (!i.fieldZone || !DANGEROUS_ZONES.has(i.fieldZone))

      ) ?? [],

    [fieldAnalysis]

  );



  const pitchZones = useMemo(() => {

    const seen = new Set<string>();

    const zones = dangerousInsights

      .map((insight) => (insight.fieldZone ? zonePitchLabels[insight.fieldZone] : null))

      .filter((zone): zone is NonNullable<typeof zone> => {

        if (!zone || seen.has(zone.id)) return false;

        seen.add(zone.id);

        return true;

      });

    return zones.length ? zones : undefined;

  }, [dangerousInsights]);



  const sections = useMemo((): AnalysisSection[] => {

    if (!fieldAnalysis || !adapted) return [];



    const list: AnalysisSection[] = [

      {

        id: "zones",

        title: "Zone chiave del campo",

        content: (

          <View style={styles.stack}>

            <FieldPitchZones zones={pitchZones} />

            {fieldAnalysis.globalSummary ? (

              <Text style={styles.summary}>{fieldAnalysis.globalSummary}</Text>

            ) : null}

          </View>

        )

      },

      {

        id: "dangerous",

        title: "Zone pericolose",

        content: (

          <View style={styles.stack}>

            <Text style={styles.sectionHint}>Aree del campo con mismatch tattico più rilevante</Text>

            <InsightCards insights={dangerousInsights} />

          </View>

        )

      },

      {

        id: "setpieces",

        title: "Palle inattive",

        content: (

          <View style={styles.stack}>

            <Text style={styles.sectionHint}>Volume e pericolosità da corner, punizioni e calci piazzati</Text>

            <SetPieceTeamRow teamName={adapted.homeTeamName} stats={adapted.params.homeTeam.setPieceStats} />

            <SetPieceTeamRow teamName={adapted.awayTeamName} stats={adapted.params.awayTeam.setPieceStats} />

            <InsightCards insights={setPieceInsights} />

          </View>

        )

      },

      {

        id: "duels",

        title: "Duelli da monitorare",

        content: monitorDuels.length ? (

          monitorDuels.map((duel, index) => (

            <SimpleDuelCard

              key={`field-duel-${index}`}

              playerA={duel.playerA}

              playerB={duel.playerB}

              teamA={duel.teamA}

              teamB={duel.teamB}

              playerAId={duel.playerAId}

              playerBId={duel.playerBId}

              roles={duel.zoneLabel}

              intensityLabel={`Intensità ${formatMetric(duel.duelScore, 1)}`}

              reading={duel.reading}

              metrics={metrics}

            />

          ))

        ) : (

          <Text style={styles.muted}>Nessun duello tattico rilevante al momento.</Text>

        )

      },

      {

        id: "pressure",

        title: "Zone di pressione",

        content: intensityAnalysis.pressureZones.length ? (

          intensityAnalysis.pressureZones.map((zone) => (

            <SimpleZoneRow

              key={zone.zoneId}

              icon="locate-outline"

              label={zone.zoneLabel}

              level={zone.intensityLevel}

            />

          ))

        ) : (

          <Text style={styles.muted}>Pressione non stimabile con i dati attuali.</Text>

        )

      }

    ];



    if (otherInsights.length) {

      list.push({

        id: "insights",

        title: "Letture tattiche",

        content: otherInsights.slice(0, 3).map((insight) => (

          <View key={insight.id} style={styles.insightCard}>

            <Text style={styles.insightTitle}>{insight.title}</Text>

            <Text style={styles.insightText}>{insight.tacticalMeaning}</Text>

          </View>

        ))

      });

    }



    return list;

  }, [

    adapted,

    dangerousInsights,

    fieldAnalysis,

    metrics,

    monitorDuels,

    otherInsights,

    pitchZones,

    setPieceInsights,

    intensityAnalysis.pressureZones

  ]);



  if (!metrics.length || !fieldAnalysis) {

    return (

      <View style={styles.empty}>

        <Text style={styles.emptyText}>

          Analisi di Campo non disponibile: servono i dati di entrambe le squadre.

        </Text>

      </View>

    );

  }



  return <AnalysisSectionPager sections={sections} />;

}



const styles = StyleSheet.create({

  stack: { gap: spacing.sm },

  sectionHint: {

    color: colors.textMuted,

    fontSize: 12,

    lineHeight: 17,

    fontWeight: "700"

  },

  summary: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },

  muted: { color: colors.textDim, fontSize: 13, lineHeight: 18 },

  statBlock: {

    padding: spacing.sm,

    borderRadius: radii.lg,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: "rgba(255,255,255,0.02)",

    gap: spacing.sm

  },

  statTeam: {

    color: colors.text,

    fontSize: 13,

    fontWeight: "900"

  },

  statGrid: {

    flexDirection: "row",

    flexWrap: "wrap",

    gap: spacing.xs

  },

  statChip: {

    minWidth: "46%",

    flexGrow: 1,

    padding: spacing.sm,

    borderRadius: radii.md,

    backgroundColor: "rgba(56,189,248,0.06)",

    borderWidth: 1,

    borderColor: "rgba(56,189,248,0.12)",

    gap: 2

  },

  statValue: {

    color: colors.cyan,

    fontSize: 16,

    fontWeight: "900"

  },

  statLabel: {

    color: colors.textDim,

    fontSize: 10,

    fontWeight: "700"

  },

  insightCard: {

    padding: spacing.md,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: "rgba(255,255,255,0.02)",

    gap: 6,

    marginBottom: spacing.sm

  },

  insightTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },

  insightText: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },

  empty: { flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center" },

  emptyText: { color: colors.textDim, textAlign: "center", lineHeight: 18 }

});


