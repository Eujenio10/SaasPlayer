import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export function EmptyReportState({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Report non disponibile</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  message: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center"
  }
});
