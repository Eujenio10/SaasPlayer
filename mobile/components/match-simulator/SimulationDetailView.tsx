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
  MatchSimulatorFixtureListItem,
  TeamSimulationSideResult
} from "@/lib/match-simulator/types";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

type MetricFormat = "goals" | "possession" | "yellowCards" | "offsides" | "default";
type ExtraMetricId = "shots" | "shotsOnTarget" | "corners" | "offsides" | "saves" | "fouls" | "yellowCards";

function hasFiniteMetricSummary(
  summary: DistributionSummary | null | undefined
): summary is DistributionSummary {
  return summary != null && Number.isFinite(summary.mean);
}

function sideMetric(side: TeamSimulationSideResult, id: ExtraMetricId): DistributionSummary | undefined {
  return side[id];
}

function MeanRangeBar(props: { summary: DistributionSummary }) {
  const mean = Number.isFinite(props.summary.mean) ? props.summary.mean : 0;
  const min = Number.isFinite(props.summary.min) ? (props.summary.min as number) : mean;
  const max = Number.isFinite(props.summary.max) ? (props.summary.max as number) : mean;
  const span = Math.max(max - min, 0.0001);
  const position = Math.min(100, Math.max(0, ((mean - min) / span) * 100));

  return (
    <View style={styles.rangeWrap}>
      <View style={styles.rangeTrack}>
        <View style={[styles.rangeFill, { width: `${position}%` }]} />
        <View style={[styles.rangeDot, { left: `${position}%` }]} />
      </View>
    </View>
  );
}

function MetricSide(props: {
  name: string;
  summary: DistributionSummary;
  metric: MetricFormat;
}) {
  const mean = Number.isFinite(props.summary.mean) ? props.summary.mean : 0;
  const min = Number.isFinite(props.summary.min) ? (props.summary.min as number) : mean;
  const max = Number.isFinite(props.summary.max) ? (props.summary.max as number) : mean;

  return (
    <View style={styles.metricSide}>
      <Text style={styles.teamLabel} numberOfLines={2}>
        {translateTeamName(props.name)}
      </Text>
      <Text style={styles.meanValue}>{formatMetricValue(mean, props.metric)}</Text>
      <View style={styles.minMaxRow}>
        <Text style={styles.minMax}>Min {formatMetricValue(min, props.metric)}</Text>
        <Text style={styles.minMax}>Max {formatMetricValue(max, props.metric)}</Text>
      </View>
      <MeanRangeBar summary={props.summary} />
    </View>
  );
}

function MetricBlock(props: {
  label: string;
  homeName: string;
  awayName: string;
  home: DistributionSummary;
  away: DistributionSummary;
  metric: MetricFormat;
}) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricTitle}>{props.label}</Text>
      <View style={styles.metricRow}>
        <MetricSide name={props.homeName} summary={props.home} metric={props.metric} />
        <MetricSide name={props.awayName} summary={props.away} metric={props.metric} />
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
  const reliabilityPct = Math.round(simulation.reliabilityScore);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroTeams}>
          <Text style={styles.heroTeam} numberOfLines={2}>
            {homeName}
          </Text>
          <Text style={styles.heroVs}>VS</Text>
          <Text style={styles.heroTeam} numberOfLines={2}>
            {awayName}
          </Text>
        </View>
        <Text style={styles.heroMeta}>
          {simulation.simulationsCount.toLocaleString("it-IT")} simulazioni · Affidabilità{" "}
          {reliabilityLabelIt(simulation.reliabilityLabel)}{" "}
          <Text style={styles.heroReliability}>{reliabilityPct}%</Text>
        </Text>
      </View>

      {hasFiniteMetricSummary(simulation.homeTeam?.goals) &&
      hasFiniteMetricSummary(simulation.awayTeam?.goals) ? (
        <MetricBlock
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
            hasFiniteMetricSummary(sideMetric(simulation.homeTeam, entry.id)) &&
            hasFiniteMetricSummary(sideMetric(simulation.awayTeam, entry.id))
        )
        .map((entry) => (
          <MetricBlock
            key={entry.id}
            label={metricLabelIt(entry.id)}
            homeName={fixture.homeTeam.name}
            awayName={fixture.awayTeam.name}
            home={sideMetric(simulation.homeTeam, entry.id)!}
            away={sideMetric(simulation.awayTeam, entry.id)!}
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
  wrap: { gap: 12, paddingBottom: 32 },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 16,
    gap: 10
  },
  heroTeams: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  heroTeam: {
    flex: 1,
    minWidth: 0,
    color: pitchbrainColors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center"
  },
  heroVs: {
    color: pitchbrainColors.textDim,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  heroMeta: {
    color: pitchbrainColors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20
  },
  heroReliability: {
    color: pitchbrainColors.green,
    fontWeight: "800"
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 14,
    gap: 8
  },
  metricBlock: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10
  },
  metricTitle: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  metricRow: {
    flexDirection: "row",
    gap: 12
  },
  metricSide: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  teamLabel: {
    color: pitchbrainColors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  meanValue: {
    color: pitchbrainColors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  minMaxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6
  },
  minMax: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1
  },
  rangeWrap: {
    marginTop: 4,
    paddingTop: 4,
    paddingBottom: 2
  },
  rangeTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: pitchbrainColors.greenMuted,
    position: "relative",
    justifyContent: "center"
  },
  rangeFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: pitchbrainColors.green
  },
  rangeDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: -2,
    backgroundColor: pitchbrainColors.green
  },
  sectionTitle: {
    color: pitchbrainColors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  body: {
    color: pitchbrainColors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  scoreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  scoreChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  scoreText: {
    color: pitchbrainColors.text,
    fontSize: 12,
    fontWeight: "600"
  }
});
