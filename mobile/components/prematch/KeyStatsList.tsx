import { StyleSheet, Text, View } from "react-native";
import type { PreMatchKeyStat } from "@/lib/prematch-report/types";
import { colors, radii, spacing } from "@/lib/theme";

export function KeyStatsList({
  stats,
  homeTeamName,
  awayTeamName
}: {
  stats: PreMatchKeyStat[];
  homeTeamName: string;
  awayTeamName: string;
}) {
  if (!stats.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.labelCol]}>Metrica</Text>
        <Text style={styles.headerCell} numberOfLines={1}>
          {homeTeamName}
        </Text>
        <Text style={styles.headerCell} numberOfLines={1}>
          {awayTeamName}
        </Text>
      </View>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.row}>
          <Text style={[styles.cell, styles.labelCol]}>{stat.label}</Text>
          <Text style={styles.cell}>{stat.homeValue}</Text>
          <Text style={styles.cell}>{stat.awayValue}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "rgba(120,170,255,0.06)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  headerCell: {
    flex: 1,
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  labelCol: { flex: 1.4 },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  cell: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600"
  }
});
