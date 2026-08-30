import { StyleSheet, View } from "react-native";
import { homeColors } from "@/components/home/home-theme";
import { spacing } from "@/lib/theme";

function Block({ height = 80, style }: { height?: number; style?: object }) {
  return <View style={[styles.block, { height }, style]} />;
}

export function HomeLoadingSkeleton() {
  return (
    <View style={styles.wrap}>
      <Block height={44} />
      <Block height={280} style={{ marginTop: spacing.md }} />
      <Block height={88} style={{ marginTop: spacing.md }} />
      <Block height={132} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.lg
  },
  block: {
    borderRadius: 18,
    backgroundColor: homeColors.skeleton,
    borderWidth: 1,
    borderColor: homeColors.border
  }
});
