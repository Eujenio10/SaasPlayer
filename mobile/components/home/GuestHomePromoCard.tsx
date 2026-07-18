import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatProPrice, PRO_PLAN_PRICING } from "@/lib/pricing";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestHomePromoCard({
  previewActive,
  onDiscoverPro,
  onWatchAd
}: {
  previewActive?: boolean;
  onDiscoverPro?: () => void;
  onWatchAd?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.guestBadge}>
          <Text style={styles.guestBadgeText}>Modalità Guest</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      <Text style={styles.title}>Sblocca tutte le statistiche</Text>
      <Text style={styles.body}>
        Con PitchBrain Pro consulti analisi complete, report pre-partita e trend su ogni match
        monitorato.
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

      <Pressable
        style={({ pressed }) => [styles.proBtn, pressed && { opacity: 0.92 }]}
        onPress={onDiscoverPro}
      >
        <Text style={styles.proBtnText}>Passa a PitchBrain Pro</Text>
        <Ionicons name="chevron-forward" size={16} color="#041018" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.adRow, pressed && { opacity: 0.9 }]}
        onPress={onWatchAd}
      >
        <Ionicons name="play-circle-outline" size={18} color={colors.cyan} />
        <Text style={styles.adText}>
          {previewActive
            ? "Simulatore e Duelli sbloccati per 15 minuti. Tocca per rinnovare con una pubblicità."
            : "Guarda una pubblicità per sbloccare Simulatore match e Duelli da monitorare per 15 minuti!"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.22)",
    backgroundColor: "rgba(8,20,40,0.92)",
    gap: spacing.sm
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  guestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.25)",
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  guestBadgeText: {
    color: colors.cyanMuted,
    fontSize: 10,
    fontWeight: "800"
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
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  pricingBox: {
    marginTop: spacing.xs,
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
  proBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.amber,
    paddingVertical: 14
  },
  proBtnText: {
    color: "#041018",
    fontSize: 14,
    fontWeight: "900"
  },
  adRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingTop: spacing.xs
  },
  adText: {
    flex: 1,
    color: colors.cyanMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  }
});
