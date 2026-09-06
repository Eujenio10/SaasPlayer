import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { FantaRatingBadge } from "@/components/fanta/FantaWidgets";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchFantaDuel, fetchFantaSearch } from "@/lib/fanta/api";
import { spacing } from "@/lib/theme";
import { FANTA_COMPETITION_ID } from "../../../lib/fanta/competition";
import type { FantaDuelResult, FantaPlayerSearchHit } from "../../../lib/fanta/types";

type Slot = "a" | "b";

export default function FantaDuelScreen() {
  const { t, locale } = useLocale();
  const [playerA, setPlayerA] = useState<FantaPlayerSearchHit | null>(null);
  const [playerB, setPlayerB] = useState<FantaPlayerSearchHit | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot>("a");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FantaPlayerSearchHit[]>([]);
  const [result, setResult] = useState<FantaDuelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetchFantaSearch({ competitionId: FANTA_COMPETITION_ID, query: q, locale })
        .then((payload) => setHits(payload.results ?? []))
        .catch(() => setHits([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [locale, query]);

  const pick = (hit: FantaPlayerSearchHit) => {
    setResult(null);
    setError(null);
    if (activeSlot === "a") {
      setPlayerA(hit);
      if (!playerB) setActiveSlot("b");
    } else {
      setPlayerB(hit);
    }
    setQuery("");
    setHits([]);
  };

  const roleError =
    playerA && playerB && playerA.roleGroup !== playerB.roleGroup ? t("fanta.duelRoleError") : null;

  const analyze = useCallback(async () => {
    if (!playerA || !playerB) return;
    if (playerA.roleGroup !== playerB.roleGroup) {
      setError(t("fanta.duelRoleError"));
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchFantaDuel({
        competitionId: FANTA_COMPETITION_ID,
        locale,
        playerAId: playerA.playerId,
        playerBId: playerB.playerId
      });
      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [locale, playerA, playerB, t]);

  const slotCard = (slot: Slot, player: FantaPlayerSearchHit | null) => {
    const selected = activeSlot === slot;
    return (
      <Pressable
        onPress={() => setActiveSlot(slot)}
        style={[styles.slot, selected && styles.slotActive]}
      >
        <Text style={styles.slotLabel}>{slot === "a" ? t("fanta.playerA") : t("fanta.playerB")}</Text>
        {player ? (
          <>
            <Text style={styles.name}>{player.playerName}</Text>
            <Text style={styles.meta}>
              {player.teamName || t("common.na")} · {t(`fanta.role.${player.roleGroup}`)}
              {player.mantra ? ` · ${player.mantra}` : ""}
            </Text>
            <Pressable
              onPress={() => {
                setResult(null);
                if (slot === "a") setPlayerA(null);
                else setPlayerB(null);
                setActiveSlot(slot);
              }}
            >
              <Text style={styles.change}>{t("fanta.duelChange")}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.meta}>{slot === "a" ? t("fanta.duelPickA") : t("fanta.duelPickB")}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AnalysisNavHeader
          backLabel={t("fanta.title")}
          title={t("fanta.lineup")}
          subtitle={t("fanta.lineupHint")}
        />
        <View style={styles.slots}>
          {slotCard("a", playerA)}
          {slotCard("b", playerB)}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={activeSlot === "a" ? t("fanta.duelPickA") : t("fanta.duelPickB")}
          placeholderTextColor={analysisColors.textMuted}
          style={styles.input}
          autoCorrect={false}
        />
        {hits.map((hit) => (
          <Pressable key={hit.playerId} onPress={() => pick(hit)} style={styles.hit}>
            <Text style={styles.name}>{hit.playerName}</Text>
            <Text style={styles.meta}>
              {hit.teamName || t("common.na")} · {t(`fanta.role.${hit.roleGroup}`)}
              {hit.mantra ? ` · ${hit.mantra}` : ""}
            </Text>
          </Pressable>
        ))}
        {roleError ? <Text style={styles.error}>{roleError}</Text> : null}
        <Pressable
          onPress={() => void analyze()}
          style={[styles.cta, (!playerA || !playerB) && styles.ctaDisabled]}
          disabled={!playerA || !playerB}
        >
          <Text style={styles.ctaText}>{t("fanta.suggestXi")}</Text>
        </Pressable>
        {loading ? <PitchBrainLoading /> : null}
        {error && !roleError ? <Text style={styles.error}>{error}</Text> : null}
        {result ? (
          <View style={styles.block}>
            <View style={styles.compareRow}>
              <View style={styles.playerCol}>
                <Text style={styles.slotLabel}>{t("fanta.playerA")}</Text>
                <Text style={styles.name}>{result.playerA.playerName}</Text>
                <Text style={styles.meta}>
                  {result.playerA.teamName || t("common.na")} · {t(`fanta.role.${result.playerA.roleGroup}`)}
                </Text>
                <Text style={styles.scoreCaption}>{t("fanta.duelScore")}</Text>
                <FantaRatingBadge value={result.playerA.fantaScore} />
              </View>
              <View style={styles.playerCol}>
                <Text style={styles.slotLabel}>{t("fanta.playerB")}</Text>
                <Text style={styles.name}>{result.playerB.playerName}</Text>
                <Text style={styles.meta}>
                  {result.playerB.teamName || t("common.na")} · {t(`fanta.role.${result.playerB.roleGroup}`)}
                </Text>
                <Text style={styles.scoreCaption}>{t("fanta.duelScore")}</Text>
                <FantaRatingBadge value={result.playerB.fantaScore} />
              </View>
            </View>
            <Text style={styles.blockTitle}>{t("fanta.duelIndicators")}</Text>
            {result.pillars.map((pillar) => (
              <View key={pillar.id} style={styles.pillar}>
                <View style={styles.pillarHead}>
                  <Text style={styles.pillarLabel}>{pillar.label}</Text>
                  <Text style={styles.winnerMark}>
                    {pillar.winner === "a"
                      ? `${result.playerA.playerName} 🟢`
                      : pillar.winner === "b"
                        ? `${result.playerB.playerName} 🟢`
                        : "—"}
                  </Text>
                </View>
                <Text style={styles.meta}>A · {pillar.detailA}</Text>
                <Text style={styles.meta}>B · {pillar.detailB}</Text>
                {pillar.edgeLabel ? <Text style={styles.edge}>{pillar.edgeLabel}</Text> : null}
              </View>
            ))}
            <View style={styles.verdict}>
              <Text style={styles.blockTitle}>
                🏆 {result.recommended === "tie" ? t("fanta.duelTie") : t("fanta.duelRecommended")}
              </Text>
              {result.recommended !== "tie" ? (
                <Text style={styles.verdictName}>
                  {result.recommended === "a" ? result.playerA.playerName : result.playerB.playerName}
                </Text>
              ) : null}
              <Text style={styles.reason}>{result.motivation}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 48, gap: 10 },
  slots: { flexDirection: "row", gap: 8 },
  slot: {
    flex: 1,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  slotActive: { borderColor: analysisColors.green },
  slotLabel: {
    color: analysisColors.green,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  input: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    color: analysisColors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  hit: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 12,
    padding: 12
  },
  block: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 12,
    gap: 10
  },
  blockTitle: {
    color: analysisColors.green,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.8
  },
  compareRow: { flexDirection: "row", gap: 12 },
  playerCol: { flex: 1, gap: 4 },
  name: { color: analysisColors.text, fontWeight: "800" },
  meta: { color: analysisColors.textMuted, fontSize: 12, lineHeight: 16 },
  change: { color: analysisColors.green, fontWeight: "700", fontSize: 12, marginTop: 4 },
  scoreCaption: { color: analysisColors.textMuted, fontSize: 11, marginTop: 8 },
  cta: {
    backgroundColor: analysisColors.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: analysisColors.ctaText, fontWeight: "800", letterSpacing: 0.4 },
  error: { color: "#FF8A8A", fontWeight: "700", fontSize: 13, lineHeight: 18 },
  pillar: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: analysisColors.border },
  pillarHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  pillarLabel: { color: analysisColors.text, fontWeight: "800", flex: 1 },
  winnerMark: { color: analysisColors.green, fontWeight: "800", fontSize: 12, maxWidth: "48%", textAlign: "right" },
  edge: { color: analysisColors.text, fontSize: 12, marginTop: 2 },
  verdict: { gap: 6, marginTop: 4 },
  verdictName: { color: analysisColors.text, fontWeight: "800", fontSize: 18 },
  reason: { color: analysisColors.text, fontSize: 13, lineHeight: 18 }
});
