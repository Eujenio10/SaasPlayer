import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { analysisColors } from "@/components/analysis/analysis-theme";

export function AnalysisNavHeader({
  backLabel,
  title,
  subtitle
}: {
  backLabel: string;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
      >
        <Ionicons name="chevron-back" size={20} color={analysisColors.green} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingBottom: 12
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    alignSelf: "flex-start",
    marginLeft: -6
  },
  backText: {
    color: analysisColors.green,
    fontSize: 14,
    fontWeight: "700"
  },
  title: {
    color: analysisColors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  subtitle: {
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  }
});
