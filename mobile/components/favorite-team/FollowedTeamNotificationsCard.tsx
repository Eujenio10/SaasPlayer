import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useRouter } from "expo-router";
import { fetchFollowedTeams, patchNotificationPreferences } from "@/lib/notifications/api";
import { syncExpoPushToken } from "@/lib/notifications/register";

export function FollowedTeamNotificationsCard() {
  const { t, locale } = useLocale();
  const { session, isGuest } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState(true);
  const [matchup, setMatchup] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;
    void fetchFollowedTeams()
      .then((payload) => {
        setPreview(payload.preferences.matchPreviewEnabled);
        setMatchup(payload.preferences.matchupEnabled);
      })
      .catch(() => undefined);
  }, [session?.user.id]);

  if (isGuest || !session) {
    return (
      <Pressable onPress={() => router.push("/login")} style={styles.card}>
        <Text style={styles.title}>{t("yourTeam.notificationsTitle")}</Text>
        <Text style={styles.body}>{t("yourTeam.notificationsLogin")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("yourTeam.notificationsTitle")}</Text>
      <Text style={styles.body}>{t("yourTeam.notificationsHint")}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t("yourTeam.notifyPreview")}</Text>
        <Switch
          value={preview}
          onValueChange={(value) => {
            setPreview(value);
            void patchNotificationPreferences({ matchPreviewEnabled: value }).catch(() => setPreview(!value));
            void syncExpoPushToken(locale).catch(() => undefined);
          }}
          trackColor={{ true: analysisColors.green }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t("yourTeam.notifyMatchup")}</Text>
        <Switch
          value={matchup}
          onValueChange={(value) => {
            setMatchup(value);
            void patchNotificationPreferences({ matchupEnabled: value }).catch(() => setMatchup(!value));
            void syncExpoPushToken(locale).catch(() => undefined);
          }}
          trackColor={{ true: analysisColors.green }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  title: { color: analysisColors.text, fontWeight: "800", fontSize: 15 },
  body: { color: analysisColors.textMuted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
  label: { color: analysisColors.text, flex: 1, fontSize: 13, fontWeight: "600" }
});
