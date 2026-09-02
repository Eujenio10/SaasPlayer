import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";
import { colors, radii, spacing } from "@/lib/theme";
import { useLocale } from "@/contexts/LocaleContext";

export function GuestAdPreviewModal() {
  const { t } = useLocale();
  const { adModalVisible, adWatching, closeAdModal, completeAdWatch } = useGuestPreview();

  if (!PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED) return null;

  return (
    <Modal visible={adModalVisible} animationType="fade" transparent onRequestClose={closeAdModal}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Ionicons name="play-circle-outline" size={42} color={colors.cyan} />
          <Text style={styles.title}>
            {MATCH_SIMULATOR_ENABLED ? t("guestAd.titleBoth") : t("guestAd.titleDuels")}
          </Text>
          <Text style={styles.body}>
            {MATCH_SIMULATOR_ENABLED ? t("guestAd.bodyBoth") : t("guestAd.bodyDuels")}
          </Text>
          {adWatching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.cyan} />
              <Text style={styles.loadingText}>{t("guestAd.watching")}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
              onPress={() => void completeAdWatch()}
            >
              <Text style={styles.primaryBtnText}>{t("guestAd.watch")}</Text>
            </Pressable>
          )}
          <Pressable onPress={closeAdModal} disabled={adWatching} hitSlop={8}>
            <Text style={styles.link}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,8,18,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.2)",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  loadingText: {
    color: colors.cyanMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  primaryBtn: {
    marginTop: spacing.sm,
    width: "100%",
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryBtnText: {
    color: "#041018",
    fontSize: 15,
    fontWeight: "900"
  },
  link: {
    marginTop: spacing.sm,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "700"
  }
});
