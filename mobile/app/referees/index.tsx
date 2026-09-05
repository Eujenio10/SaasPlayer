import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefereeSeverityScreen } from "@/components/referees/RefereeSeverityScreen";
import { analysisColors } from "@/components/analysis/analysis-theme";

export default function RefereesIndexScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <RefereeSeverityScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: analysisColors.bg
  }
});
