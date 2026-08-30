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
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { radii, spacing } from "@/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function ensureSession() {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setReady(true);
      setLoading(false);
    }

    void ensureSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      router.replace("/");
    } catch (err) {
      setError(mapAuthError(err instanceof Error ? err : new Error("update_failed")));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={pitchbrainColors.green} size="large" />
        <Text style={styles.loadingText}>Preparazione reset password…</Text>
      </View>
    );
  }

  if (!ready) return null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.badge}>PitchBrain</Text>
        <Text style={styles.title}>Nuova password</Text>
        <Text style={styles.subtitle}>Scegli una nuova password per il tuo account.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Nuova password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Almeno 8 caratteri"
          placeholderTextColor={pitchbrainColors.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>Conferma password</Text>
        <TextInput
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Ripeti la password"
          placeholderTextColor={pitchbrainColors.textDim}
          style={styles.input}
        />

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting || !password || !confirm}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
            (!password || !confirm) && styles.buttonDisabled
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={pitchbrainColors.ctaText} />
          ) : (
            <Text style={styles.buttonText}>Salva password</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: pitchbrainColors.bg,
    padding: spacing.lg
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: pitchbrainColors.bg
  },
  loadingText: {
    color: pitchbrainColors.textMuted,
    fontSize: 14
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
  }
});
