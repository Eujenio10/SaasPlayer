import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyStatsList } from "./KeyStatsList";
import { ReportProgressBar } from "./ReportProgressBar";
import type { PreMatchKeyStat } from "@/lib/prematch-report/types";
import { colors, radii, spacing } from "@/lib/theme";

export function ReportSectionCard({
  title,
  description,
  text,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  keyStats,
  highlight,
  children
}: {
  title: string;
  description?: string;
  text: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  keyStats?: PreMatchKeyStat[];
  highlight?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {highlight}
      {homeScore != null && awayScore != null ? (
        <View style={styles.scores}>
          <ReportProgressBar label={homeTeamName} value={homeScore} color={colors.cyan} />
          <ReportProgressBar label={awayTeamName} value={awayScore} color={colors.amber} />
        </View>
      ) : null}
      <Text style={styles.text}>{text}</Text>
      {children}
      {keyStats?.length ? (
        <KeyStatsList stats={keyStats} homeTeamName={homeTeamName} awayTeamName={awayTeamName} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  description: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  scores: { marginTop: spacing.sm },
  text: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  }
});
