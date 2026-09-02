import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MatchRadarScreen } from "@/components/match-radar/MatchRadarScreen";
import { useLocale } from "@/contexts/LocaleContext";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { spacing } from "@/lib/theme";

export default function MatchRadarIndexScreen() {
  const { locale } = useLocale();
  return (
    <>
      <Stack.Screen
        options={{
          title: MATCH_RADAR_UI_TEXT[locale].title,
          headerStyle: { backgroundColor: pitchbrainColors.bg },
          headerTintColor: pitchbrainColors.green,
          headerTitleStyle: { color: pitchbrainColors.text, fontWeight: "800" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: pitchbrainColors.bg }
        }}
      />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>
              <Text style={styles.brandPitch}>Pitch</Text>
              <Text style={styles.brandBrain}>Brain</Text>
            </Text>
          </View>
          <MatchRadarScreen />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pitchbrainColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  brandWrap: { marginBottom: 4 },
  brand: { fontSize: 22, fontWeight: "800" },
  brandPitch: { color: pitchbrainColors.text },
  brandBrain: { color: pitchbrainColors.green }
});
