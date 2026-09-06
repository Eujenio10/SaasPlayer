import { StyleSheet, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";
import type { FantaMatchupTone, FantaTrendDirection } from "../../../lib/fanta/types";

export function FantaRatingBadge({ value }: { value: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.score}>{Math.round(value)}</Text>
      <Text style={styles.over}>/100</Text>
    </View>
  );
}

export function FantaTrendGlyph({ trend }: { trend: FantaTrendDirection }) {
  const label = trend === "up" ? "📈" : trend === "down" ? "📉" : "➡";
  const color =
    trend === "up" ? analysisColors.green : trend === "down" ? "#FF6B6B" : analysisColors.textMuted;
  return <Text style={[styles.trend, { color }]}>{label}</Text>;
}

export function FantaToneBadge({
  tone,
  labels
}: {
  tone: FantaMatchupTone;
  labels: Record<FantaMatchupTone, string>;
}) {
  const bg =
    tone === "favorable" ? "rgba(124,255,58,0.16)" : tone === "difficult" ? "rgba(255,80,80,0.16)" : "rgba(255,210,70,0.14)";
  const color = tone === "favorable" ? analysisColors.green : tone === "difficult" ? "#FF8A8A" : "#F5D76E";
  const prefix = tone === "favorable" ? "🟢" : tone === "difficult" ? "🔴" : "🟡";
  return (
    <View style={[styles.tone, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.toneText, { color }]}>
        {prefix} {labels[tone]}
      </Text>
    </View>
  );
}

export function FantaSparkline({ values }: { values: Array<number | null> }) {
  const nums = values.filter((n): n is number => n != null && n > 0);
  const min = nums.length ? Math.min(...nums, 5) : 5;
  const max = nums.length ? Math.max(...nums, 8) : 8;
  return (
    <View style={styles.spark}>
      {values.map((value, index) => {
        const ratio = value != null && value > 0 ? (value - min) / Math.max(0.4, max - min) : 0;
        return (
          <View key={`${index}-${value ?? "n"}`} style={styles.barTrack}>
            <View style={[styles.barFill, { height: Math.max(6, Math.round(ratio * 56)) }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  score: {
    color: analysisColors.green,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1
  },
  over: {
    color: analysisColors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  trend: {
    fontSize: 22
  },
  tone: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  toneText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  spark: {
    height: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  barTrack: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    backgroundColor: "rgba(124,255,58,0.08)",
    borderRadius: 4,
    overflow: "hidden"
  },
  barFill: {
    width: "100%",
    backgroundColor: analysisColors.green,
    borderRadius: 4
  }
});
