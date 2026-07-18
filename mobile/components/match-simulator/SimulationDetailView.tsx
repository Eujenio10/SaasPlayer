import { StyleSheet, Text, View } from "react-native";
import { translateTeamName } from "@/lib/italian-display";
import {
  formatMetricValue,
  MATCH_SIMULATOR_METHOD_EXPLANATION,
  MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION,
  MATCH_SIMULATOR_SCORE_NOTE,
  metricLabelIt,
  reliabilityLabelIt
} from "@/lib/match-simulator/text";
import type {
  DistributionSummary,
  MatchSimulationResult,
  MatchSimulatorFixtureListItem
} from "@/lib/match-simulator/types";
import { colors, radii, spacing } from "@/lib/theme";

type MetricTheme = {
  titleColor: string;
  borderColor: string;
  backgroundColor: string;
  homeDot: string;
  awayDot: string;
  homeFill: string;
  awayFill: string;
  homeTrack: string;
  awayTrack: string;
  meanColor: string;
};

const METRIC_THEMES: Record<string, MetricTheme> = {
  goals: {
    titleColor: "#a5f3fc",
    borderColor: "rgba(34,211,238,0.35)",
    backgroundColor: "rgba(34,211,238,0.08)",
    homeDot: "#7dd3fc",
    awayDot: "#5eead4",
    homeFill: "rgba(56,189,248,0.5)",
    awayFill: "rgba(45,212,191,0.5)",
    homeTrack: "rgba(8,47,73,0.75)",
    awayTrack: "rgba(4,47,46,0.75)",
    meanColor: "#cffafe"
  },
  shots: {
    titleColor: "#bfdbfe",
    borderColor: "rgba(96,165,250,0.35)",
    backgroundColor: "rgba(59,130,246,0.08)",
    homeDot: "#93c5fd",
    awayDot: "#a5b4fc",
    homeFill: "rgba(96,165,250,0.5)",
    awayFill: "rgba(129,140,248,0.5)",
    homeTrack: "rgba(23,37,84,0.75)",
    awayTrack: "rgba(30,27,75,0.75)",
    meanColor: "#dbeafe"
  },
  shotsOnTarget: {
    titleColor: "#ddd6fe",
    borderColor: "rgba(167,139,250,0.35)",
    backgroundColor: "rgba(139,92,246,0.08)",
    homeDot: "#c4b5fd",
    awayDot: "#d8b4fe",
    homeFill: "rgba(167,139,250,0.5)",
    awayFill: "rgba(192,132,252,0.5)",
    homeTrack: "rgba(46,16,101,0.75)",
    awayTrack: "rgba(59,7,100,0.75)",
    meanColor: "#ede9fe"
  },
  corners: {
    titleColor: "#fde68a",
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(245,158,11,0.08)",
    homeDot: "#fcd34d",
    awayDot: "#fdba74",
    homeFill: "rgba(251,191,36,0.5)",
    awayFill: "rgba(251,146,60,0.5)",
    homeTrack: "rgba(69,26,3,0.75)",
    awayTrack: "rgba(67,20,7,0.75)",
    meanColor: "#fef3c7"
  },
  offsides: {
    titleColor: "#fecdd3",
    borderColor: "rgba(251,113,133,0.35)",
    backgroundColor: "rgba(244,63,94,0.08)",
    homeDot: "#fda4af",
    awayDot: "#f9a8d4",
    homeFill: "rgba(251,113,133,0.5)",
    awayFill: "rgba(244,114,182,0.5)",
    homeTrack: "rgba(76,5,25,0.75)",
    awayTrack: "rgba(80,7,36,0.75)",
    meanColor: "#ffe4e6"
  },
  saves: {
    titleColor: "#99f6e4",
    borderColor: "rgba(45,212,191,0.35)",
    backgroundColor: "rgba(20,184,166,0.08)",
    homeDot: "#5eead4",
    awayDot: "#67e8f9",
    homeFill: "rgba(45,212,191,0.5)",
    awayFill: "rgba(34,211,238,0.5)",
    homeTrack: "rgba(4,47,46,0.75)",
    awayTrack: "rgba(8,51,68,0.75)",
    meanColor: "#ccfbf1"
  },
  fouls: {
    titleColor: "#fed7aa",
    borderColor: "rgba(251,146,60,0.35)",
    backgroundColor: "rgba(249,115,22,0.08)",
    homeDot: "#fdba74",
    awayDot: "#fca5a5",
    homeFill: "rgba(251,146,60,0.5)",
    awayFill: "rgba(248,113,113,0.5)",
    homeTrack: "rgba(67,20,7,0.75)",
    awayTrack: "rgba(69,10,10,0.75)",
    meanColor: "#ffedd5"
  },
  yellowCards: {
    titleColor: "#fef08a",
    borderColor: "rgba(250,204,21,0.35)",
    backgroundColor: "rgba(234,179,8,0.08)",
    homeDot: "#fde047",
    awayDot: "#fcd34d",
    homeFill: "rgba(250,204,21,0.55)",
    awayFill: "rgba(251,191,36,0.55)",
    homeTrack: "rgba(66,32,6,0.75)",
    awayTrack: "rgba(69,26,3,0.75)",
    meanColor: "#fef9c3"
  }
};

function getMetricTheme(metricId: string): MetricTheme {
  return METRIC_THEMES[metricId] ?? METRIC_THEMES.goals;
}

function hasFiniteMetricSummary(
  summary: DistributionSummary | null | undefined
): summary is DistributionSummary {
  return summary != null && Number.isFinite(summary.mean);
}

function MeanRangeBar(props: {
  summary: DistributionSummary;
  metric: "goals" | "possession" | "yellowCards" | "offsides" | "default";
  theme: MetricTheme;
  side: "home" | "away";
}) {
  const mean = Number.isFinite(props.summary.mean) ? props.summary.mean : 0;
  const min = Number.isFinite(props.summary.min) ? props.summary.min : mean;
  const max = Number.isFinite(props.summary.max) ? props.summary.max : mean;
  const span = Math.max(max - min, 0.0001);
  const position = Math.min(100, Math.max(0, ((mean - min) / span) * 100));
  const isHome = props.side === "home";
  const dotColor = isHome ? props.theme.homeDot : props.theme.awayDot;
  const fillColor = isHome ? props.theme.homeFill : props.theme.awayFill;
  const trackColor = isHome ? props.theme.homeTrack : props.theme.awayTrack;
  const meanValue = formatMetricValue(mean, props.metric);

  return (
    <View style={styles.rangeWrap}>
      <View style={[styles.rangeTrack, { backgroundColor: trackColor }]}>
        <View style={[styles.rangeFill, { width: `${position}%`, backgroundColor: fillColor }]} />
        <View
          style={[
            styles.rangeDot,
            { left: `${position}%`, backgroundColor: dotColor, borderColor: "rgba(255,255,255,0.45)" }
          ]}
        />
      </View>
      <View style={styles.rangeLabels}>
        <Text style={[styles.rangeEdge, styles.rangeEdgeLeft]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          Min. {formatMetricValue(min, props.metric)}
        </Text>
        <Text
          style={[styles.rangeMeanLarge, { color: props.theme.meanColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {meanValue}
        </Text>
        <Text style={[styles.rangeEdge, styles.rangeEdgeRight]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          Max. {formatMetricValue(max, props.metric)}
        </Text>
      </View>
      <Text style={[styles.rangeMeanCaption, { color: props.theme.meanColor }]}>Media simulata</Text>
    </View>
  );
}

function MetricBlock(props: {
  metricId: string;
  label: string;
  homeName: string;
  awayName: string;
  home: DistributionSummary;
  away: DistributionSummary;
  metric: "goals" | "possession" | "yellowCards" | "offsides" | "default";
}) {
  const theme = getMetricTheme(props.metricId);

  return (
    <View
      style={[
        styles.metricBlock,
        { borderColor: theme.borderColor, backgroundColor: theme.backgroundColor }
      ]}
    >
      <Text style={[styles.metricTitle, { color: theme.titleColor }]}>{props.label}</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricSide}>
          <Text style={styles.teamLabel}>{translateTeamName(props.homeName)}</Text>
          <MeanRangeBar summary={props.home} metric={props.metric} theme={theme} side="home" />
        </View>
        <View style={styles.metricSide}>
          <Text style={styles.teamLabel}>{translateTeamName(props.awayName)}</Text>
          <MeanRangeBar summary={props.away} metric={props.metric} theme={theme} side="away" />
        </View>
      </View>
    </View>
  );
}

function MethodologyPanel() {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Come vengono calcolati i valori</Text>
      <Text style={styles.body}>{MATCH_SIMULATOR_METHOD_EXPLANATION}</Text>
      <Text style={styles.body}>{MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION}</Text>
    </View>
  );
}

export function SimulationDetailView(props: {
  fixture: MatchSimulatorFixtureListItem;
  simulation: MatchSimulationResult;
}) {
  const { fixture, simulation } = props;
  const homeName = translateTeamName(fixture.homeTeam.name);
  const awayName = translateTeamName(fixture.awayTeam.name);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {homeName} — {awayName}
        </Text>
        <Text style={styles.heroMeta}>
          {simulation.simulationsCount.toLocaleString("it-IT")} simulazioni · Affidabilità{" "}
          {reliabilityLabelIt(simulation.reliabilityLabel)} ({Math.round(simulation.reliabilityScore)}%)
        </Text>
      </View>

      {hasFiniteMetricSummary(simulation.homeTeam?.goals) &&
      hasFiniteMetricSummary(simulation.awayTeam?.goals) ? (
        <MetricBlock
          metricId="goals"
          label={metricLabelIt("goals")}
          homeName={fixture.homeTeam.name}
          awayName={fixture.awayTeam.name}
          home={simulation.homeTeam.goals}
          away={simulation.awayTeam.goals}
          metric="goals"
        />
      ) : null}
      {(
        [
          { id: "shots", metric: "default" as const },
          { id: "shotsOnTarget", metric: "default" as const },
          { id: "corners", metric: "default" as const },
          { id: "offsides", metric: "offsides" as const },
          { id: "saves", metric: "default" as const },
          { id: "fouls", metric: "default" as const },
          { id: "yellowCards", metric: "yellowCards" as const }
        ] as const
      )
        .filter(
          (entry) =>
            hasFiniteMetricSummary(simulation.homeTeam?.[entry.id]) &&
            hasFiniteMetricSummary(simulation.awayTeam?.[entry.id])
        )
        .map((entry) => (
          <MetricBlock
            key={entry.id}
            metricId={entry.id}
            label={metricLabelIt(entry.id)}
            homeName={fixture.homeTeam.name}
            awayName={fixture.awayTeam.name}
            home={simulation.homeTeam[entry.id]}
            away={simulation.awayTeam[entry.id]}
            metric={entry.metric}
          />
        ))}

      {simulation.refereeContext ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Arbitro e cartellini</Text>
          <Text style={styles.body}>
            Media arbitro: {simulation.refereeContext.yellowCardsPerMatch?.toFixed(1) ?? "n/d"}{" "}
            cartellini a partita
            {simulation.refereeContext.foulsPerMatch != null
              ? ` · ${simulation.refereeContext.foulsPerMatch.toFixed(1)} falli a partita`
              : ""}
          </Text>
        </View>
      ) : null}

      {simulation.mostLikelyScores?.length ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Risultati più frequenti</Text>
          <Text style={styles.body}>{MATCH_SIMULATOR_SCORE_NOTE}</Text>
          <View style={styles.scoreRow}>
            {simulation.mostLikelyScores.slice(0, 4).map((score) => (
              <View key={`${score.homeGoals}-${score.awayGoals}`} style={styles.scoreChip}>
                <Text style={styles.scoreText}>
                  {score.homeGoals}-{score.awayGoals} · {Math.round(score.probability * 100)}% di
                  probabilità stimata
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <MethodologyPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.15)",
    backgroundColor: "rgba(103,232,249,0.06)",
    padding: spacing.md,
    gap: spacing.xs
  },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  heroMeta: { color: colors.textMuted, fontSize: 13 },
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  metricBlock: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  metricRow: { flexDirection: "column", gap: spacing.lg },
  metricSide: { flex: 1, gap: spacing.sm },
  teamLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  rangeWrap: { gap: 8 },
  rangeTrack: {
    height: 14,
    borderRadius: radii.pill,
    position: "relative",
    justifyContent: "center",
    overflow: "hidden"
  },
  rangeFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill
  },
  rangeDot: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    top: -4,
    borderWidth: 3
  },
  rangeLabels: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "nowrap",
    width: "100%"
  },
  rangeEdge: { color: colors.textDim, fontSize: 11, flexShrink: 1, minWidth: 0 },
  rangeEdgeLeft: { flex: 1, textAlign: "left", paddingRight: 4 },
  rangeEdgeRight: { flex: 1, textAlign: "right", paddingLeft: 4 },
  rangeMeanLarge: {
    flexShrink: 0,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 6,
    minWidth: 56
  },
  rangeMeanCaption: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  scoreChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  scoreText: { color: colors.text, fontSize: 12, fontWeight: "600" }
});
