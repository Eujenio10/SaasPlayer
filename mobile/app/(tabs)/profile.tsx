import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { userStatusLabel } from "@/lib/access/features";
import { colors, radii, spacing } from "@/lib/theme";
import { useState } from "react";

function roleFeatures(role: string | undefined): string[] {
  if (role === "admin") {
    return [
      "Accesso completo a tutte le competizioni",
      "Aggiornamento dati e refresh",
      "Gestione snapshot organizzazione"
    ];
  }
  if (role === "pro") {
    return [
      "Analisi illimitate su tutte le competizioni",
      "Report Pre-Partita completo",
      "Nessun limite settimanale partite"
    ];
  }
  return [
    "Partite e analisi base",
    "Esplorazione moduli gratuiti",
    "Upgrade a Pro per report completi"
  ];
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, access, userStatus, signOut, deleteAccount } = useAuth();
  const { openPaywall, handleRestorePurchases } = useAccessFlow();
  const [deleting, setDeleting] = useState(false);

  const email = user?.email ?? "—";
  const features = roleFeatures(access?.role);

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Elimina account",
      "Questa azione è definitiva: account, preferenze e dati personali collegati verranno cancellati. Gli abbonamenti store vanno gestiti anche da Impostazioni Apple/Google.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina definitivamente",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeleting(true);
                await deleteAccount();
                router.replace("/");
              } catch {
                Alert.alert(
                  "Eliminazione non riuscita",
                  "Riprova più tardi o contatta il supporto."
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
      <Screen>
        <Text style={styles.title}>Modalità Guest</Text>
        <Text style={styles.subtitle}>
          Stai usando PitchBrain senza account. Puoi esplorare partite e analisi base. Accedi solo se
          vuoi attivare Pro, sincronizzare i dati o recuperare il tuo abbonamento.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stato</Text>
          <Text style={styles.statusBadge}>Modalità Guest</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.primaryBtnText}>Accedi</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          onPress={() => router.push({ pathname: "/login", params: { mode: "register" } })}
        >
          <Text style={styles.secondaryBtnText}>Crea account gratis</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.9 }]}
          onPress={() => openPaywall("fullPreMatchReport")}
        >
          <Text style={styles.linkBtnText}>Scopri PitchBrain Pro</Text>
        </Pressable>
      </Screen>
    );
  }

  const planLabel =
    userStatus === "authenticated_pro"
      ? "Pro"
      : userStatus === "expired_pro"
        ? "Pro scaduto"
        : "Free";

  return (
    <Screen>
      <Text style={styles.title}>Il mio profilo</Text>
      <Text style={styles.subtitle}>Gestisci il tuo account e visualizza il piano assegnato.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.role}>Piano {planLabel}</Text>
        <Text style={styles.statusBadge}>{userStatusLabel(userStatus)}</Text>
      </View>

      {userStatus === "expired_pro" ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Abbonamento</Text>
          <Text style={styles.feature}>
            Il tuo Piano Pro non risulta più attivo. Riattivalo per sbloccare report completi e analisi
            avanzate.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Funzionalità incluse</Text>
        {features.map((feature) => (
          <Text key={feature} style={styles.feature}>
            • {feature}
          </Text>
        ))}
      </View>

      {access?.isMember && access.matchUsage.limit != null ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Utilizzo settimanale</Text>
          <Text style={styles.feature}>
            Partite analizzate: {access.matchUsage.used}/{access.matchUsage.limit}
          </Text>
          <Text style={styles.feature}>Rimanenti: {access.matchUsage.remaining ?? 0}</Text>
        </View>
      ) : null}

      {userStatus === "authenticated_free" || userStatus === "expired_pro" ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
          onPress={() => openPaywall("fullPreMatchReport")}
        >
          <Text style={styles.primaryBtnText}>
            {userStatus === "expired_pro" ? "Riattiva Pro" : "Passa a Pro"}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
        onPress={() => void handleRestorePurchases()}
      >
        <Text style={styles.secondaryBtnText}>Ripristina acquisti</Text>
      </Pressable>

      {userStatus === "authenticated_pro" ? (
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          onPress={() => openPaywall("fullPreMatchReport")}
        >
          <Text style={styles.secondaryBtnText}>Gestisci abbonamento</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => void signOut().then(() => router.replace("/"))}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      <Pressable
        disabled={deleting}
        onPress={confirmDeleteAccount}
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.deleteBtnText}>
          {deleting ? "Eliminazione in corso…" : "Elimina account"}
        </Text>
      </Pressable>

      <Text style={styles.footer}>PitchBrain Hub © 2025 | IlDodicesimo</Text>
      <Text style={styles.footerSub}>Piattaforma di Analisi Statistica ed Editoriale.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 6,
    marginBottom: spacing.lg,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  cardLabel: {
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  email: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  role: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 14
  },
  statusBadge: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: "hidden",
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(56,189,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)"
  },
  feature: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  primaryBtn: {
    marginBottom: spacing.sm,
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
    marginBottom: spacing.sm,
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
  linkBtn: {
    marginTop: spacing.xs,
    paddingVertical: 10,
    alignItems: "center"
  },
  linkBtnText: {
    color: colors.cyanMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  logout: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    paddingVertical: 14,
    alignItems: "center"
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "800"
  },
  deleteBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.55)",
    backgroundColor: "rgba(248,113,113,0.08)",
    paddingVertical: 14,
    alignItems: "center"
  },
  deleteBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800"
  },
  footer: {
    marginTop: spacing.xl,
    textAlign: "center",
    color: colors.textDim,
    fontSize: 11
  },
  footerSub: {
    marginTop: 4,
    textAlign: "center",
    color: colors.textDim,
    fontSize: 10
  }
});
