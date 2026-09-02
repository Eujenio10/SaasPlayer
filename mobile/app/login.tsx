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
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { radii, spacing } from "@/lib/theme";
import { useLocale } from "@/contexts/LocaleContext";

type AuthMode = "login" | "register" | "recover";

const RESEND_COOLDOWN_SEC = 60;

function ModeTabs({
  mode,
  onChange
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  const { t } = useLocale();
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
              {tab === "login" ? t("login.signIn") : t("login.register")}
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
  const { t } = useLocale();
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
          setSuccessMessage(t("login.recoverSent"));
      } else {
        if (password.length < 8) {
          setError(t("login.passwordMin"));
          return;
        }
        if (password !== confirmPassword) {
          setError(t("login.passwordMismatch"));
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
      console.warn("[auth] submit failed", err);
      setError(mapAuthError(err));
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
      setSuccessMessage(t("login.resendSuccess"));
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      console.warn("[auth] resend failed", err);
      setError(mapAuthError(err));
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
        ? t("login.checkEmail")
        : t("login.recover")
      : mode === "login"
        ? t("login.signIn")
        : registerSent
          ? t("login.checkEmail")
          : t("login.createAccount");

  const subtitle =
    mode === "recover"
      ? recoverSent
        ? t("login.recoverSentSubtitle")
        : t("login.recoverSubtitle")
      : mode === "login"
        ? t("login.loginSubtitle")
        : registerSent
          ? t("login.registerSentSubtitle")
          : t("login.registerSubtitle");

  const registerSteps = [t("login.step1"), t("login.step2"), t("login.step3")];

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

          {error ? (
            <Text style={styles.error} selectable>
              {error}
            </Text>
          ) : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          {mode === "login" && !registerSent ? (
            <>
              <Text style={styles.label}>{t("login.email")}</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder={t("login.placeholderEmail")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
              <Text style={styles.label}>{t("login.password")}</Text>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={t("login.placeholderPassword")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
              <Pressable onPress={() => switchMode("recover")} hitSlop={8}>
                <Text style={styles.link}>{t("login.forgot")}</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "recover" && !recoverSent ? (
            <>
              <Text style={styles.label}>{t("login.email")}</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder={t("login.placeholderEmail")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
            </>
          ) : null}

          {mode === "register" && !registerSent ? (
            <>
              <Text style={styles.label}>{t("login.email")}</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder={t("login.placeholderEmail")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
              <Text style={styles.label}>{t("login.password")}</Text>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={t("login.placeholderMinChars")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
              <Text style={styles.label}>{t("login.confirmPassword")}</Text>
              <TextInput
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t("login.placeholderRepeat")}
                placeholderTextColor={pitchbrainColors.textDim}
                style={styles.input}
              />
              <StepList steps={registerSteps} />
            </>
          ) : null}

          {registerSent ? (
            <>
              <StepList steps={registerSteps} />
              <Pressable
                onPress={() => void handleResend()}
                disabled={resending || resendCooldown > 0}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  (pressed || resending || resendCooldown > 0) && { opacity: 0.6 }
                ]}
              >
                {resending ? (
                  <ActivityIndicator color={pitchbrainColors.green} />
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    {resendCooldown > 0
                      ? t("login.resendIn", { seconds: resendCooldown })
                      : t("login.resendConfirm")}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
                onPress={() => switchMode("login")}
              >
                <Text style={styles.secondaryBtnText}>{t("login.confirmedSignIn")}</Text>
              </Pressable>
            </>
          ) : null}

          {recoverSent ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
              onPress={() => switchMode("login")}
            >
              <Text style={styles.secondaryBtnText}>{t("login.backToLogin")}</Text>
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
                <ActivityIndicator color={pitchbrainColors.ctaText} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === "login"
                    ? t("login.enterPitchBrain")
                    : mode === "recover"
                      ? t("login.sendReset")
                      : t("login.createAccount")}
                </Text>
              )}
            </Pressable>
          ) : null}

          {mode === "recover" && !recoverSent ? (
            <Pressable onPress={() => switchMode("login")} hitSlop={8} style={styles.guestWrap}>
              <Text style={styles.guestLink}>{t("login.backToLogin")}</Text>
            </Pressable>
          ) : null}

          {mode !== "recover" && !registerSent ? (
            <Pressable onPress={() => router.replace("/")} hitSlop={8} style={styles.guestWrap}>
              <Text style={styles.guestLink}>{t("login.continueGuest")}</Text>
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
    backgroundColor: pitchbrainColors.bg
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: spacing.lg
  },
  badge: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    marginTop: spacing.sm,
    color: pitchbrainColors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    marginTop: spacing.sm,
    color: pitchbrainColors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  tabs: {
    flexDirection: "row",
    marginTop: spacing.lg,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: pitchbrainColors.bgAlt,
    borderWidth: 1,
    borderColor: pitchbrainColors.border
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  tabActive: {
    backgroundColor: pitchbrainColors.green
  },
  tabText: {
    color: pitchbrainColors.textDim,
    fontSize: 14,
    fontWeight: "700"
  },
  tabTextActive: {
    color: pitchbrainColors.ctaText
  },
  error: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    color: pitchbrainColors.danger,
    fontSize: 13,
    lineHeight: 18
  },
  success: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: pitchbrainColors.borderStrong,
    color: pitchbrainColors.green,
    fontSize: 13,
    lineHeight: 18
  },
  label: {
    marginTop: spacing.md,
    marginBottom: 6,
    color: pitchbrainColors.textMuted,
    fontSize: 13
  },
  input: {
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    borderRadius: radii.lg,
    backgroundColor: pitchbrainColors.bgAlt,
    color: pitchbrainColors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15
  },
  link: {
    marginTop: spacing.sm,
    color: pitchbrainColors.green,
    fontSize: 13,
    fontWeight: "600"
  },
  stepsBox: {
    marginTop: spacing.md,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.bgAlt
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
    backgroundColor: pitchbrainColors.cardAlt,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  stepBadgeText: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800"
  },
  stepText: {
    flex: 1,
    color: pitchbrainColors.textDim,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 2
  },
  button: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: pitchbrainColors.green,
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
    color: pitchbrainColors.ctaText,
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryBtn: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: pitchbrainColors.borderStrong,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center"
  },
  secondaryBtnText: {
    color: pitchbrainColors.green,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  guestWrap: {
    marginTop: spacing.md,
    alignItems: "center"
  },
  guestLink: {
    color: pitchbrainColors.textDim,
    fontSize: 13,
    fontWeight: "600"
  }
});
