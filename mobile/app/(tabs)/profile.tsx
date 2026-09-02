import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { userStatusLabel } from "@/lib/access/features";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

function roleFeatures(isAdmin: boolean, t: (path: string) => string): string[] {
  if (isAdmin) {
    return [t("profile.featureAdmin1"), t("profile.featureAdmin2"), t("profile.featureAdmin3")];
  }
  return [t("profile.featureFree1"), t("profile.featureFree2"), t("profile.featureFree3")];
}

function StatusIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.iconCircle}>
      <Ionicons name={name} size={18} color={pitchbrainColors.green} />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, access, userStatus, signOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const email = user?.email ?? "—";
  const isAdmin = Boolean(access?.isAdmin);
  const features = roleFeatures(isAdmin, t);

  const confirmDeleteAccount = () => {
    Alert.alert(
      t("profile.deleteTitle"),
      t("profile.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.deleteConfirm"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeleting(true);
                await deleteAccount();
                router.replace("/");
              } catch {
                Alert.alert(
                  t("profile.deleteFailedTitle"),
                  t("profile.deleteFailedBody")
                );
              } finally {
                setDeleting(false);
              }
            })();
          }
        }
      ]
    );
  };

  if (userStatus === "guest") {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.guestContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heroTitle}>
            <Text style={styles.heroTitlePlain}>{t("profile.guestTitlePlain")}</Text>
            <Text style={styles.heroTitleAccent}>{t("profile.guestTitleAccent")}</Text>
          </Text>
          <Text style={styles.subtitle}>{t("profile.guestSubtitle")}</Text>

          <View style={styles.card}>
            <View style={styles.statusRow}>
              <StatusIcon name="person-outline" />
              <View style={styles.statusCopy}>
                <Text style={styles.cardLabel}>{t("profile.status")}</Text>
                <Text style={styles.statusValue}>{userStatusLabel(userStatus)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.login")}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryBtnText}>{t("profile.login")}</Text>
            <Ionicons name="arrow-forward" size={18} color={pitchbrainColors.ctaText} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.createAccount")}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/login", params: { mode: "register" } })}
          >
            <Ionicons name="person-add-outline" size={18} color={pitchbrainColors.green} />
            <Text style={styles.secondaryBtnText}>{t("profile.createAccount")}</Text>
            <Ionicons name="chevron-forward" size={18} color={pitchbrainColors.green} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const planLabel = isAdmin ? "Admin" : "Free";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroTitle}>
          <Text style={styles.heroTitlePlain}>{t("profile.titlePlain")}</Text>
            <Text style={styles.heroTitleAccent}>{t("profile.titleAccent")}</Text>
          </Text>
          <Text style={styles.subtitle}>{t("profile.subtitle")}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabelAccent}>{t("profile.account")}</Text>
          <View style={styles.accountRow}>
            <StatusIcon name="person-outline" />
            <View style={styles.accountCopy}>
              <Text style={styles.email} numberOfLines={2}>
                {email}
              </Text>
              <Text style={styles.accessType}>{t("profile.access", { plan: planLabel })}</Text>
              <Text style={styles.roleLine}>
                {isAdmin ? "Admin" : userStatusLabel(userStatus)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabelAccent}>{t("profile.included")}</Text>
          {features.map((feature, index) => (
            <View
              key={feature}
              style={[styles.featureRow, index > 0 && styles.featureDivider]}
            >
              <Ionicons name="checkmark" size={16} color={pitchbrainColors.green} />
              <Text style={styles.feature}>{feature}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.logout")}
          onPress={() => {
            void signOut()
              .then(() => router.replace("/"))
              .catch(() => router.replace("/"));
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={18} color={pitchbrainColors.danger} />
          <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          <Ionicons name="chevron-forward" size={18} color={pitchbrainColors.danger} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleting ? t("profile.deleting") : t("profile.deleteAccount")}
          disabled={deleting}
          onPress={confirmDeleteAccount}
          hitSlop={8}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={18} color={pitchbrainColors.danger} />
          <Text style={styles.deleteBtnText}>
            {deleting ? t("profile.deleting") : t("profile.deleteAccount")}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={pitchbrainColors.danger} />
        </Pressable>

        <Text style={styles.footer}>{t("profile.footer")}</Text>
        <Text style={styles.footerSub}>{t("profile.footerSub")}</Text>
        <Text style={styles.legalDisclaimer}>{t("profile.legal")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: pitchbrainColors.bg
  },
  guestContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 120,
    gap: 0
  },
  authContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 38
  },
  heroTitlePlain: {
    color: pitchbrainColors.text
  },
  heroTitleAccent: {
    color: pitchbrainColors.green
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 28,
    color: pitchbrainColors.textMuted,
    fontSize: 16,
    lineHeight: 23
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 16
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(154,242,56,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  cardLabel: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  cardLabelAccent: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 12
  },
  statusValue: {
    color: pitchbrainColors.green,
    fontSize: 16,
    fontWeight: "700"
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  email: {
    color: pitchbrainColors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  accessType: {
    color: pitchbrainColors.green,
    fontSize: 15,
    fontWeight: "700"
  },
  roleLine: {
    color: pitchbrainColors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10
  },
  featureDivider: {
    borderTopWidth: 1,
    borderTopColor: pitchbrainColors.divider
  },
  feature: {
    flex: 1,
    color: pitchbrainColors.text,
    fontSize: 14,
    lineHeight: 20
  },
  primaryBtn: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: pitchbrainColors.green,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryBtnText: {
    color: pitchbrainColors.ctaText,
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryBtn: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: pitchbrainColors.borderStrong,
    backgroundColor: pitchbrainColors.bgAlt,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  secondaryBtnText: {
    flex: 1,
    color: pitchbrainColors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  logoutBtn: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: pitchbrainColors.bgAlt,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logoutText: {
    flex: 1,
    color: pitchbrainColors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  deleteBtn: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.55)",
    backgroundColor: "rgba(248,113,113,0.08)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  deleteBtnText: {
    flex: 1,
    color: pitchbrainColors.danger,
    fontSize: 16,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.88
  },
  footer: {
    marginTop: 32,
    textAlign: "center",
    color: pitchbrainColors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  footerSub: {
    marginTop: 4,
    textAlign: "center",
    color: pitchbrainColors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  legalDisclaimer: {
    marginTop: 10,
    marginBottom: 8,
    textAlign: "center",
    color: pitchbrainColors.textDim,
    fontSize: 11,
    lineHeight: 16
  }
});
