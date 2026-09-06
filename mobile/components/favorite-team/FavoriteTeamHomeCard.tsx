import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { homeColors } from "@/components/home/home-theme";
import { useFavoriteTeam } from "@/contexts/FavoriteTeamContext";
import { useLocale } from "@/contexts/LocaleContext";
import { genericTeamColor, teamInitialsFromName } from "@/lib/match-display";
import { spacing } from "@/lib/theme";

export function FavoriteTeamHomeCard({ onPick }: { onPick: () => void }) {
  const router = useRouter();
  const { t } = useLocale();
  const { favoriteTeams, activeTeam } = useFavoriteTeam();

  if (!favoriteTeams.length) {
    return (
      <Pressable
        onPress={onPick}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
        accessibilityRole="button"
        accessibilityLabel={t("yourTeam.pickA11y")}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="shirt-outline" size={22} color={homeColors.green} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t("yourTeam.homeTitle")}</Text>
          <Text style={styles.body}>{t("yourTeam.homeBodyGuest")}</Text>
        </View>
        <Text style={styles.link}>{t("yourTeam.choose")}</Text>
      </Pressable>
    );
  }

  const color = genericTeamColor(activeTeam?.teamName ?? favoriteTeams[0]!.teamName);
  const names = favoriteTeams.map((team) => team.teamName).join(" · ");

  return (
    <Pressable
      onPress={() => router.push("/your-team" as Href)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      accessibilityRole="button"
      accessibilityLabel={t("yourTeam.openA11y", { team: names })}
    >
      <View style={[styles.avatar, { borderColor: `${color}88` }]}>
        <Text style={[styles.avatarText, { color }]}>
          {teamInitialsFromName(activeTeam?.teamName ?? favoriteTeams[0]!.teamName)}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t("yourTeam.sectionTitle")}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {names}
        </Text>
      </View>
      <Text style={styles.link}>{t("yourTeam.open")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    paddingHorizontal: 12,
    paddingVertical: 14
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: "rgba(23,53,26,0.45)"
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
    gap: 3
  },
  title: {
    color: homeColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  body: {
    color: homeColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500"
  },
  link: {
    color: homeColors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    flexShrink: 0
  }
});
