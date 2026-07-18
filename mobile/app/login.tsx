import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { colors, radii, spacing } from "@/lib/theme";

type AuthMode = "login" | "register";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, session } = useAuth();
  const { resumePendingAction } = useAccessFlow();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staySignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      resumePendingAction();
      router.replace("/");
    }
  }, [session, resumePendingAction, router]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch {
      setError("Credenziali non valide o account non autorizzato.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.badge}>PitchBrain</Text>
        <Text style={styles.title}>Accedi a PitchBrain</Text>
        <Text style={styles.subtitle}>
          Ti serve un account solo per attivare Pro, sincronizzare i dati o recuperare il tuo abbonamento.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="nome@email.it"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />

        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, staySignedIn && styles.checkboxActive]} />
          <Text style={styles.checkboxLabel}>Resta collegato su questo dispositivo</Text>
        </View>

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting || !email || !password}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
            (!email || !password) && styles.buttonDisabled
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "login" ? "Accedi con email" : "Crea account"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} hitSlop={8}>
          <Text style={styles.switchMode}>
            {mode === "login" ? "Non hai un account? Crea account" : "Hai già un account? Accedi"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/")} hitSlop={8}>
          <Text style={styles.guestLink}>Continua come Guest</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  badge: {
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    marginTop: spacing.sm,
    color: colors.cyan,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  error: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    color: colors.danger,
    fontSize: 13
  },
  label: {
    marginTop: spacing.md,
    marginBottom: 6,
    color: colors.textMuted,
    fontSize: 13
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    borderRadius: radii.lg,
    backgroundColor: "#0A1628",
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  checkboxActive: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan
  },
  checkboxLabel: {
    color: colors.textDim,
    fontSize: 12
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  buttonPressed: {
    opacity: 0.9
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "800"
  },
  switchMode: {
    marginTop: spacing.md,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  guestLink: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  }
});
