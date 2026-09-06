import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { spacing } from "@/lib/theme";

export default function FantaHubScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const items: Array<{ href: Href; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { href: "/fanta/scout", title: t("fanta.scout"), subtitle: t("fanta.scoutHint"), icon: "search-outline" },
    { href: "/fanta/lineup", title: t("fanta.lineup"), subtitle: t("fanta.lineupHint"), icon: "flash-outline" },
    { href: "/fanta/matchups", title: t("fanta.matchup"), subtitle: t("fanta.matchupHint"), icon: "git-compare-outline" },
    { href: "/fanta/trends", title: t("fanta.trends"), subtitle: t("fanta.trendsHint"), icon: "trending-up-outline" },
    { href: "/fanta/ranking", title: t("fanta.ranking"), subtitle: t("fanta.rankingHint"), icon: "podium-outline" }
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnalysisNavHeader backLabel={t("menu.home")} title={t("fanta.title")} subtitle={t("fanta.subtitle")} />
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              key={String(item.href)}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color={analysisColors.green} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardHint}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={analysisColors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  list: { gap: 10, marginTop: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,255,58,0.1)"
  },
  copy: { flex: 1 },
  cardTitle: { color: analysisColors.text, fontWeight: "800", fontSize: 16 },
  cardHint: { color: analysisColors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 }
});
