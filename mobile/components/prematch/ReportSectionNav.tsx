import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export type ReportSectionId =
  | "summary"
  | "realForm"
  | "offensive"
  | "defensive"
  | "keyZone"
  | "tempo"
  | "setPieces";

export const PREMATCH_SECTIONS: Array<{ id: ReportSectionId; title: string; short: string }> = [
  { id: "summary", title: "Sintesi iniziale", short: "Sintesi" },
  { id: "realForm", title: "Stato di forma reale", short: "Forma" },
  { id: "offensive", title: "Profilo offensivo", short: "Offensiva" },
  { id: "defensive", title: "Profilo difensivo", short: "Difesa" },
  { id: "keyZone", title: "Dove può decidersi", short: "Zona chiave" },
  { id: "tempo", title: "Ritmo e controllo", short: "Ritmo" },
  { id: "setPieces", title: "Palle inattive", short: "Fermo" }
];

export function ReportSectionNav({
  active,
  onChange
}: {
  active: ReportSectionId;
  onChange: (id: ReportSectionId) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Sezioni del report</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PREMATCH_SECTIONS.map((section, index) => {
          const selected = section.id === active;
          return (
            <Pressable
              key={section.id}
              onPress={() => onChange(section.id)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipActive,
                pressed && { opacity: 0.9 }
              ]}
            >
              <Text style={[styles.chipIndex, selected && styles.chipIndexActive]}>{index + 1}</Text>
              <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
                {section.short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.sm
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: {
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.12)"
  },
  chipIndex: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "900"
  },
  chipIndexActive: { color: colors.cyan },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 88
  },
  chipTextActive: { color: colors.text }
});
