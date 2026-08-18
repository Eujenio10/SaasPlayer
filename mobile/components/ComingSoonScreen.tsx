import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COMING_SOON_MESSAGE } from "@/lib/coming-soon";
import { colors, spacing } from "@/lib/theme";

export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{COMING_SOON_MESSAGE}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
  },
  message: {
    color: colors.cyan,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  }
});
