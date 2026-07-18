import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

const benefits = [
  "Analisi avanzate complete",
  "Report dettagliati scaricabili",
  "Alert e trend personalizzati",
  "Accesso su tutti i dispositivi"
];

export function ProUpsellCard({ onPress }: { onPress?: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.proBadge}>
        <Text style={styles.proBadgeText}>PRO</Text>
      </View>

      <Text style={styles.title}>Sblocca tutto il potenziale di PitchBrain</Text>
      <Text style={styles.subtitle}>Più dati, più analisi, più vantaggi.</Text>

      <View style={styles.benefits}>
        {benefits.map((item) => (
          <View key={item} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.cyan} />
            <Text style={styles.benefitText}>{item}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
      >
        <Text style={styles.ctaText}>Registrati per PitchBrain Pro</Text>
        <Ionicons name="chevron-forward" size={18} color="#041018" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.22)",
    backgroundColor: "rgba(8,20,40,0.92)"
  },
  proBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.35)",
    backgroundColor: "rgba(103,232,249,0.1)"
  },
  proBadgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  title: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  benefits: {
    marginTop: spacing.md,
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
  cta: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan
  },
  ctaText: {
    color: "#041018",
    fontSize: 14,
    fontWeight: "900"
  }
});
