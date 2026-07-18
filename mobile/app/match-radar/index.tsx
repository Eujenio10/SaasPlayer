import { ScrollView, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MatchRadarScreen } from "@/components/match-radar/MatchRadarScreen";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";
import { colors, spacing } from "@/lib/theme";

export default function MatchRadarIndexScreen() {
  return (
    <>
      <Stack.Screen options={{ title: MATCH_RADAR_UI_TEXT.it.title }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MatchRadarScreen />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl }
});
