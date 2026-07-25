import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";
import { colors, radii, spacing } from "@/lib/theme";

type AuthMode = "login" | "register" | "recover";

const RESEND_COOLDOWN_SEC = 60;

const REGISTER_STEPS = [
  "Inserisci email e password",
  "Conferma dall'email che ti inviamo",
  "Accedi a PitchBrain"
] as const;

function ModeTabs({
  mode,
  onChange
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  return (
    <View style={styles.tabs}>
      {(["login", "register"] as const).map((tab) => {
        const active = mode === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {tab === "login" ? "Accedi" : "Registrati"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <View style={styles.stepsBox}>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp, resendConfirmation, resetPassword, session } = useAuth();
  const { resumePendingAction } = useAccessFlow();
  const initialMode: AuthMode = params.mode === "register" ? "register" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registerSent, setRegisterSent] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (params.mode === "register") setMode("register");
  }, [params.mode]);

  useEffect(() => {
    if (session?.user?.email_confirmed_at) {
      resumePendingAction();
      router.replace("/");
    }
  }, [session, resumePendingAction, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setSuccessMessage(null);
    setRegisterSent(false);
    setRecoverSent(false);
    setConfirmPassword("");
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else if (mode === "recover") {
        await resetPassword(email.trim());
        setRecoverSent(true);
        setSuccessMessage(
          "Ti abbiamo inviato un'email con le istruzioni per reimpostare la password."
        );
      } else {
        if (password.length < 8) {
          setError("La password deve avere almeno 8 caratteri.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Le password non coincidono.");
          return;
        }
        const result = await signUp(email.trim(), password);
        if (result.alreadyRegistered) {
          switchMode("login");
          setError(result.message);
        } else {
          setRegisterSent(true);
          setSuccessMessage(result.message);
          setResendCooldown(RESEND_COOLDOWN_SEC);
        }
      }
    } catch (err) {
      setError(mapAuthError(err instanceof Error ? err : new Error("auth_failed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending || !email.trim()) return;
    setError(null);
    setResending(true);
    try {
      await resendConfirmation(email.trim());
      setSuccessMessage("Email di conferma reinviata. Controlla posta in arrivo e spam.");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(mapAuthError(err instanceof Error ? err : new Error("resend_failed")));
    } finally {
      setResending(false);
    }
  }

  const canSubmit =
    mode === "login"
      ? Boolean(email.trim() && password)
      : mode === "recover"
        ? Boolean(email.trim()) && !recoverSent
        : Boolean(email.trim() && password && confirmPassword) && !registerSent;

  const title =
    mode === "recover"
      ? recoverSent
        ? "Controlla la email"
        : "Recupera password"
      : mode === "login"
        ? "Accedi"
        : registerSent
          ? "Controlla la email"
          : "Crea account";

  const subtitle =
    mode === "recover"
      ? recoverSent
        ? "Apri il link nell'email per scegliere una nuova password."
        : "Inserisci l'email dell'account: ti invieremo un link di reset."
      : mode === "login"
        ? "Sincronizza sblocchi, Pro e preferenze su tutti i dispositivi."
        : registerSent
          ? "Apri il link di conferma nell'email per attivare l'account."
          : "Gratis. Conferma l'email per completare la registrazione.";

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.badge}>PitchBrain</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {mode !== "recover" && !registerSent && !recoverSent ? (
            <ModeTabs mode={mode} onChange={switchMode} />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          {mode === "login" && !registerSent ? (
            <>
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
                placeholder="La tua password"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <Pressable onPress={() => switchMode("recover")} hitSlop={8}>
                <Text style={styles.link}>Password dimenticata?</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "recover" && !recoverSent ? (
            <>
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
            </>
          ) : null}

          {mode === "register" && !registerSent ? (
            <>
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
                placeholder="Almeno 8 caratteri"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <Text style={styles.label}>Conferma password</Text>
              <TextInput
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Ripeti la password"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <StepList steps={REGISTER_STEPS} />
            </>
          ) : null}

          {registerSent ? (
            <>
              <StepList steps={REGISTER_STEPS} />
              <Pressable
                onPress={() => void handleResend()}
                disabled={resending || resendCooldown > 0}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  (pressed || resending || resendCooldown > 0) && { opacity: 0.6 }
                ]}
              >
                {resending ? (
                  <ActivityIndicator color={colors.cyan} />
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    {resendCooldown > 0
                      ? `Reinvia email tra ${resendCooldown}s`
                      : "Reinvia email di conferma"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                onPress={() => switchMode("login")}
              >
                <Text style={styles.secondaryBtnText}>Ho confermato — Accedi</Text>
              </Pressable>
            </>
          ) : null}

          {recoverSent ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
              onPress={() => switchMode("login")}
            >
              <Text style={styles.secondaryBtnText}>Torna al login</Text>
            </Pressable>
          ) : null}

          {!registerSent && !recoverSent ? (
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={submitting || !canSubmit}
              style={({ pressed }) => [
                styles.button,
                (pressed || submitting) && styles.buttonPressed,
                !canSubmit && styles.buttonDisabled
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === "login"
                    ? "Entra in PitchBrain"
                    : mode === "recover"
                      ? "Invia link di reset"
                      : "Crea account"}
                </Text>
              )}
            </Pressable>
          ) : null}

          {mode === "recover" && !recoverSent ? (
            <Pressable onPress={() => switchMode("login")} hitSlop={8} style={styles.guestWrap}>
              <Text style={styles.guestLink}>Torna al login</Text>
            </Pressable>
          ) : null}

          {mode !== "recover" && !registerSent ? (
            <Pressable onPress={() => router.replace("/")} hitSlop={8} style={styles.guestWrap}>
              <Text style={styles.guestLink}>Continua senza account</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    flexGrow: 1,
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
  tabs: {
    flexDirection: "row",
    marginTop: spacing.lg,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.15)"
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: "center"
  },
  tabActive: {
    backgroundColor: colors.cyan
  },
  tabText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: "700"
  },
  tabTextActive: {
    color: colors.background
  },
  error: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18
  },
  success: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.35)",
    color: colors.cyanMuted,
    fontSize: 13,
    lineHeight: 18
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
  link: {
    marginTop: spacing.sm,
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "600"
  },
  stepsBox: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.12)",
    backgroundColor: "#0A1628"
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(103,232,249,0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  stepBadgeText: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800"
  },
  stepText: {
    flex: 1,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 2
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
  secondaryBtn: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center"
  },
  secondaryBtnText: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  guestWrap: {
    marginTop: spacing.md,
    alignItems: "center"
  },
  guestLink: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600"
  }
});
