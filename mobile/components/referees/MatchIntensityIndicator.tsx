import { StyleSheet, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { translateIntensityPreviewLabel } from "@/lib/i18n";
import { intensityUiLevel } from "@/lib/match-display";
import type { MatchIntensityPreview } from "@/lib/types";

function fillWidth(level: "low" | "medium" | "high"): `${number}%` {
  if (level === "high") return "100%";
  if (level === "medium") return "66%";
  return "34%";
}

function shortLabel(preview: MatchIntensityPreview, locale: "it" | "en"): string {
  const ui = intensityUiLevel(preview.uiLevel ?? preview.level);
  if (ui === "high") return locale === "it" ? "Alta" : "High";
  if (ui === "medium") return locale === "it" ? "Media" : "Medium";
  return locale === "it" ? "Bassa" : "Low";
}

/** Indicatore visivo dell'intensità partita già calcolata (nessun nuovo algoritmo). */
export function MatchIntensityIndicator({ intensity }: { intensity: MatchIntensityPreview | null }) {
  const { t, locale } = useLocale();

  if (!intensity || (intensity.value == null && !intensity.label)) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("referees.intensity")}</Text>
        <Text style={styles.missing}>{t("common.na")}</Text>
      </View>
    );
  }

  const ui = intensityUiLevel(intensity.uiLevel ?? intensity.level);
  const label = shortLabel(intensity, locale);
  const a11y = translateIntensityPreviewLabel(intensity.label, locale);

  return (
    <View style={styles.wrap} accessibilityLabel={`${t("referees.intensity")}: ${a11y}`}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("referees.intensity")}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth(ui) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  label: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  missing: {
    color: analysisColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(124,255,58,0.12)",
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: analysisColors.green
  }
});

