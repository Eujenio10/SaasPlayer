import { FOULS_ANALYSIS_UI } from "@/lib/fouls-analysis-ui-text";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export type MatchAnalysisTab = "intensity" | "teamForm" | "prematch" | "playerPerformance";

const tabs: Array<{ id: MatchAnalysisTab; label: string }> = [
  { id: "intensity", label: FOULS_ANALYSIS_UI.title },
  { id: "teamForm", label: "Forma Squadre" },
  { id: "playerPerformance", label: "Player Performance" },
  { id: "prematch", label: "Pre-Partita" }
];

const tabHints: Record<MatchAnalysisTab, string> = {
  intensity: FOULS_ANALYSIS_UI.tabHint,
  teamForm: "Segnali statistici su tiri, corner e cartellini basati sui dati disponibili.",
  playerPerformance: "Produzione offensiva recente, Danger Index e trend dei giocatori.",
  prematch: "Lettura tecnica pre-partita su ritmo, controllo e punti chiave."
};

const guestTabHints: Record<MatchAnalysisTab, string> = {
  intensity: FOULS_ANALYSIS_UI.guestTabHint,
  teamForm: "Segnali completi su tiri, corner e cartellini — disponibile in modalità Guest.",
  playerPerformance: "Analisi offensiva dei giocatori basata sulle ultime partite concluse.",
  prematch: "Report pre-partita completo riservato a PitchBrain Pro."
};

export function MatchAnalysisTabs({
  active,
  onChange,
  isGuest = false
}: {
  active: MatchAnalysisTab;
  onChange: (tab: MatchAnalysisTab) => void;
  isGuest?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarScroll}
      >
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => onChange(tab.id)}
              style={[styles.tabButton, active === tab.id && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.hint}>{(isGuest ? guestTabHints : tabHints)[active]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  tabBarScroll: {
    flexGrow: 1
  },
  tabBar: {
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: "100%"
  },
  tabButton: {
    flex: 1,
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center"
  },
  tabButtonActive: {
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.12)"
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center"
  },
  tabLabelActive: {
    color: colors.cyan
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17
  }
});
