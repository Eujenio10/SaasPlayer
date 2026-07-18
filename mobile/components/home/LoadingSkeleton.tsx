import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

function Block({ height = 80, style }: { height?: number; style?: object }) {
  return <View style={[styles.block, { height }, style]} />;
}

export function HomeLoadingSkeleton() {
  return (
    <View style={styles.wrap}>
      <Block height={220} />
      <Block height={240} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.xl
  },
  block: {
    borderRadius: radii.xl,
    backgroundColor: "rgba(120,170,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(120,170,255,0.06)"
  }
});
