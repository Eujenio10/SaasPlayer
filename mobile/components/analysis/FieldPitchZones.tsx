import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

const defaultZones = [
  { id: "01", label: "Ultimo terzo offensivo", color: colors.emerald },
  { id: "02", label: "Centrocampo", color: colors.cyan },
  { id: "03", label: "Difesa centrale", color: "#67E8F9" }
];

export function FieldPitchZones({
  zones = defaultZones
}: {
  zones?: Array<{ id: string; label: string; color: string }>;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pitch}>
        {zones.map((zone, index) => (
          <View
            key={zone.id}
            style={[
              styles.slice,
              index < zones.length - 1 && styles.sliceBorder,
              { borderColor: `${zone.color}44` }
            ]}
          >
            <Text style={[styles.zoneId, { color: zone.color }]}>{zone.id}</Text>
            <Text style={styles.zoneLabel}>{zone.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  },
  pitch: {
    flexDirection: "row",
    minHeight: 120,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.18)",
    backgroundColor: "rgba(6,14,28,0.95)",
    overflow: "hidden"
  },
  slice: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    gap: 6
  },
  sliceBorder: {
    borderRightWidth: 1
  },
  zoneId: {
    fontSize: 22,
    fontWeight: "900"
  },
  zoneLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 13
  }
});
