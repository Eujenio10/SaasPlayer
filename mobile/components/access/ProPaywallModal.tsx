import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { userStatusLabel } from "@/lib/access/features";
import type { UserAccessStatus } from "@/lib/access/types";
import { formatProPrice, PRO_PLAN_PRICING } from "@/lib/pricing";
import { colors, radii, spacing } from "@/lib/theme";

const benefits = [
  "Analisi illimitate senza video",
  "Marcature difficili complete",
  "Nessuna pubblicità",
  "Abbonamento mensile via App Store / Play Store",
  "Accesso su più dispositivi con lo stesso account"
];

function primaryCtaLabel(status: UserAccessStatus): string {
  if (status === "guest") return "Crea account e continua";
  if (status === "expired_pro") return "Riattiva Pro";
  return "Attiva Pro";
}

export function ProPaywallModal() {
  const { userStatus } = useAuth();
  const {
    paywallVisible,
    closePaywall,
    continueAsGuest,
    openAuthFromPaywall,
    handleActivatePro,
    handleRestorePurchases,
    restoreMessage,
    purchaseMessage,
    clearMessages
  } = useAccessFlow();

  if (!paywallVisible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={closePaywall}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
              <Pressable onPress={closePaywall} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.title}>Sblocca PitchBrain Pro</Text>
            <Text style={styles.subtitle}>
              Report completi e analisi avanzate per leggere meglio ogni partita.
            </Text>

            <View style={styles.pricingBox}>
              <View style={styles.discountPill}>
                <Text style={styles.discountText}>-{PRO_PLAN_PRICING.discountPercent}%</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.oldPrice}>{formatProPrice(PRO_PLAN_PRICING.originalPrice)}</Text>
                <Text style={styles.newPrice}>{formatProPrice(PRO_PLAN_PRICING.monthlyPrice)}</Text>
                <Text style={styles.perMonth}>/mese</Text>
              </View>
              <Text style={styles.priceHint}>
                Offerta lancio: da {formatProPrice(PRO_PLAN_PRICING.originalPrice)} a{" "}
                {formatProPrice(PRO_PLAN_PRICING.monthlyPrice)} al mese.
              </Text>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{userStatusLabel(userStatus)}</Text>
            </View>

            <View style={styles.benefits}>
              {benefits.map((item) => (
                <View key={item} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.cyan} />
                  <Text style={styles.benefitText}>{item}</Text>
                </View>
              ))}
            </View>

            {purchaseMessage ? <Text style={styles.info}>{purchaseMessage}</Text> : null}
            {restoreMessage ? <Text style={styles.info}>{restoreMessage}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
              onPress={() => {
                clearMessages();
                if (userStatus === "guest") {
                  openAuthFromPaywall();
                  return;
                }
                void handleActivatePro();
              }}
            >
              <Text style={styles.primaryBtnText}>{primaryCtaLabel(userStatus)}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
              onPress={continueAsGuest}
            >
              <Text style={styles.secondaryBtnText}>Continua come Guest</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                clearMessages();
                void handleRestorePurchases();
              }}
              hitSlop={8}
            >
              <Text style={styles.link}>Ripristina acquisti</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,8,18,0.82)",
    justifyContent: "flex-end"
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.18)",
    backgroundColor: colors.surfaceAlt
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.35)",
    backgroundColor: "rgba(250,204,21,0.1)"
  },
  proBadgeText: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  pricingBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.2)",
    backgroundColor: "rgba(250,204,21,0.06)",
    gap: 6
  },
  discountPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.amber
  },
  discountText: {
    color: "#041018",
    fontSize: 10,
    fontWeight: "900"
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  oldPrice: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "line-through"
  },
  newPrice: {
    color: colors.amber,
    fontSize: 28,
    fontWeight: "900"
  },
  perMonth: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    paddingBottom: 4
  },
  priceHint: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(56,189,248,0.1)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)"
  },
  statusPillText: {
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "800"
  },
  benefits: {
    gap: spacing.sm
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  benefitText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  info: {
    color: colors.cyanMuted,
    fontSize: 12,
    lineHeight: 17
  },
  primaryBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.amber,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryBtnText: {
    color: "#041018",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryBtn: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    alignItems: "center"
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  link: {
    textAlign: "center",
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: spacing.sm
  }
});
