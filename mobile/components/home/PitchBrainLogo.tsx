import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

export function PitchBrainLogo({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Ionicons name="football" size={size * 0.42} color={colors.cyan} style={styles.ball} />
      <View style={styles.brainLeft} />
      <View style={styles.brainRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.35)",
    backgroundColor: "rgba(8,20,40,0.95)",
    overflow: "hidden"
  },
  ball: {
    opacity: 0.15,
    position: "absolute"
  },
  brainLeft: {
    position: "absolute",
    left: 8,
    width: 10,
    height: 18,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    borderRightWidth: 0,
    opacity: 0.85
  },
  brainRight: {
    position: "absolute",
    right: 8,
    width: 10,
    height: 18,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    borderLeftWidth: 0,
    opacity: 0.85
  }
});
