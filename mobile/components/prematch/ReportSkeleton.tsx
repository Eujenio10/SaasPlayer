import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

function Block({ height = 72 }: { height?: number }) {
  return <View style={[styles.block, { height }]} />;
}

export function ReportSkeleton() {
  return (
    <View style={styles.wrap}>
      <Block height={120} />
      <Block height={180} />
      <Block height={220} />
      <Block height={48} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.lg },
  block: {
    borderRadius: radii.xl,
    backgroundColor: "rgba(120,170,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(120,170,255,0.06)"
  }
});
