import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeTodaySummary } from "@/lib/home-dashboard/types";
import { colors, radii, spacing } from "@/lib/theme";

function formatMetric(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

interface SummaryCardProps {
  summary: HomeTodaySummary;
}

const tiles: Array<{
  key: keyof HomeTodaySummary;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}> = [
  { key: "monitoredMatchesCount", label: "Partite oggi", icon: "football", accent: colors.cyan },
  { key: "keyDuelsCount", label: "Scontri chiave", icon: "git-compare", accent: colors.emerald },
  { key: "foulsSignalsCount", label: "Segnali falli", icon: "shield", accent: colors.amber }
];

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Riepilogo giornata</Text>
      <View style={styles.grid}>
        {tiles.map((tile) => {
          const raw = summary[tile.key];
          const display = typeof raw === "number" ? formatMetric(raw) : "—";
          return (
            <View key={tile.key} style={styles.tile}>
              <Ionicons name={tile.icon} size={18} color={tile.accent} />
              <Text style={styles.value}>{display}</Text>
              <Text style={styles.label}>{tile.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: spacing.md
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tile: {
    width: "47%",
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(120,170,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  value: {
    marginTop: 6,
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  label: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  }
});
