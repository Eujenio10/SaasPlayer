import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { homeColors } from "@/components/home/home-theme";
import { useFavoriteTeam } from "@/contexts/FavoriteTeamContext";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchMatches } from "@/lib/api";
import { uniqueTeamsFromMatches } from "@/lib/favorite-team/teams-from-matches";
import { MAX_FAVORITE_TEAMS, type FavoriteTeamOption } from "@/lib/favorite-team/types";
import { genericTeamColor, teamInitialsFromName } from "@/lib/match-display";
import { spacing } from "@/lib/theme";

export function FavoriteTeamPickerModal({
  visible,
  onClose,
  onboarding = false
}: {
  visible: boolean;
  onClose: () => void;
  onboarding?: boolean;
}) {
  const { t } = useLocale();
  const { addFavoriteTeam, removeFavoriteTeam, isFavorite, completeOnboarding, favoriteTeams } =
    useFavoriteTeam();
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<FavoriteTeamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setError(false);
    let cancelled = false;
    setLoading(true);
    void fetchMatches()
      .then((payload) => {
        if (cancelled) return;
        setTeams(uniqueTeamsFromMatches(payload.matches ?? []));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) => team.teamName.toLowerCase().includes(needle));
  }, [query, teams]);

  const dismiss = async () => {
    if (onboarding) await completeOnboarding();
    onClose();
  };

  const atMax = favoriteTeams.length >= MAX_FAVORITE_TEAMS;

  const toggle = async (team: FavoriteTeamOption) => {
    if (isFavorite(team.teamId)) {
      await removeFavoriteTeam(team.teamId);
      return;
    }
    if (atMax) return;
    await addFavoriteTeam({
      teamId: team.teamId,
      teamName: team.teamName,
      competitionId: team.competitionId
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => void dismiss()}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(onboarding ? "yourTeam.onboardingTitle" : "yourTeam.pickTitle")}</Text>
          {onboarding ? null : (
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text style={styles.close}>{t("common.close")}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.hint}>
          {t(onboarding ? "yourTeam.onboardingHint" : "yourTeam.pickHint")}
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("yourTeam.searchPlaceholder")}
          placeholderTextColor={homeColors.textMuted}
          autoCorrect={false}
          style={styles.search}
        />
        {loading ? (
          <ActivityIndicator color={homeColors.green} style={styles.loader} />
        ) : error ? (
          <Text style={styles.empty}>{t("yourTeam.pickFailed")}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {filtered.map((team) => {
              const selected = isFavorite(team.teamId);
              const locked = !selected && atMax;
              const color = genericTeamColor(team.teamName);
              return (
                <Pressable
                  key={team.teamId}
                  onPress={() => void toggle(team)}
                  disabled={locked}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    locked && styles.rowLocked,
                    pressed && !locked && { opacity: 0.88 }
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: locked }}
                >
                  <View style={[styles.avatar, { borderColor: `${color}88` }]}>
                    <Text style={[styles.avatarText, { color }]}>{teamInitialsFromName(team.teamName)}</Text>
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{team.teamName}</Text>
                    <Text style={styles.comp}>{team.competitionName}</Text>
                  </View>
                  <Text style={styles.badge}>{selected ? t("yourTeam.selected") : t("yourTeam.add")}</Text>
                </Pressable>
              );
            })}
            {!filtered.length ? <Text style={styles.empty}>{t("yourTeam.noTeams")}</Text> : null}
          </ScrollView>
        )}
        <View style={styles.footer}>
          <Text style={styles.count}>
            {atMax
              ? t("yourTeam.maxReached", { max: MAX_FAVORITE_TEAMS })
              : t("yourTeam.count", { count: favoriteTeams.length, max: MAX_FAVORITE_TEAMS })}
          </Text>
          <View style={styles.footerRow}>
            {onboarding ? (
              <Pressable onPress={() => void dismiss()} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.85 }]}>
                <Text style={styles.skipText}>{t("yourTeam.later")}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void dismiss()} style={({ pressed }) => [styles.done, pressed && { opacity: 0.9 }]}>
              <Text style={styles.doneText}>{t("yourTeam.done")}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: homeColors.bg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  title: {
    color: homeColors.text,
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12
  },
  close: {
    color: homeColors.green,
    fontSize: 15,
    fontWeight: "700"
  },
  hint: {
    color: homeColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: spacing.sm
  },
  search: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    color: homeColors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  loader: {
    marginTop: 40
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  rowSelected: {
    borderColor: homeColors.borderStrong
  },
  rowLocked: {
    opacity: 0.45
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "800"
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  name: {
    color: homeColors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  comp: {
    color: homeColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  badge: {
    color: homeColors.green,
    fontSize: 11,
    fontWeight: "800"
  },
  empty: {
    color: homeColors.textMuted,
    textAlign: "center",
    marginTop: 24,
    fontSize: 14
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: homeColors.border
  },
  count: {
    color: homeColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  footerRow: {
    flexDirection: "row",
    gap: 10
  },
  skip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  skipText: {
    color: homeColors.textMuted,
    fontSize: 15,
    fontWeight: "700"
  },
  done: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: homeColors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  doneText: {
    color: homeColors.ctaText,
    fontSize: 15,
    fontWeight: "800"
  }
});
