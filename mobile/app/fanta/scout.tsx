import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchFantaSearch } from "@/lib/fanta/api";
import { spacing } from "@/lib/theme";
import { FANTA_COMPETITION_ID } from "../../../lib/fanta/competition";
import type { FantaPlayerSearchHit } from "../../../lib/fanta/types";

export default function FantaScoutSearchScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FantaPlayerSearchHit[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void fetchFantaSearch({ competitionId: FANTA_COMPETITION_ID, query: q, locale })
        .then((payload) => {
          if (!cancelled) setResults(payload.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locale, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AnalysisNavHeader backLabel={t("fanta.title")} title={t("fanta.scout")} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("fanta.searchPlaceholder")}
          placeholderTextColor={analysisColors.textMuted}
          style={styles.input}
          autoCorrect={false}
        />
        {loading ? <PitchBrainLoading /> : null}
        <View style={styles.list}>
          {results.map((hit) => (
            <Pressable
              key={hit.playerId}
              onPress={() =>
                router.push({
                  pathname: "/fanta/scout/[playerId]",
                  params: { playerId: hit.playerId, competitionId: FANTA_COMPETITION_ID }
                })
              }
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View>
                <Text style={styles.name}>{hit.playerName}</Text>
                <Text style={styles.meta}>
                  {hit.teamName || t("common.na")} · {t(`fanta.role.${hit.roleGroup}`)}
                  {hit.mantra ? ` · ${hit.mantra}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    color: analysisColors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  list: { gap: 8 },
  row: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 14,
    padding: 14
  },
  name: { color: analysisColors.text, fontWeight: "800", fontSize: 16 },
  meta: { color: analysisColors.textMuted, marginTop: 4, fontSize: 12 }
});
