import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sendAppFeedback } from "@/lib/feedback/api";
import { colors, radii, spacing } from "@/lib/theme";

export function HomeFeedbackCard({
  isGuest,
  accountEmail
}: {
  isGuest: boolean;
  accountEmail?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError("Scrivi almeno 10 caratteri.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendAppFeedback({
        message: trimmed,
        contactEmail: isGuest ? contactEmail : undefined
      });
      setSent(true);
      setMessage("");
      setContactEmail("");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Invio non riuscito.";
      setError(
        raw === "rate_limited"
          ? "Hai già inviato alcuni messaggi. Riprova tra qualche minuto."
          : raw.includes(" ")
            ? raw
            : "Invio non riuscito. Riprova tra poco."
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle-outline" size={22} color={colors.emerald} />
        </View>
        <Text style={styles.title}>Grazie per il feedback</Text>
        <Text style={styles.subtitle}>
          Il messaggio è arrivato a support@pitchbrain.it. Lo leggeremo volentieri.
        </Text>
        <Pressable onPress={() => setSent(false)} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ghostBtnText}>Invia un altro messaggio</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.cyan} />
      </View>
      <Text style={styles.title}>Cosa ne pensi di PitchBrain?</Text>
      <Text style={styles.subtitle}>
        Scrivi un feedback: arriverà direttamente a support@pitchbrain.it.
      </Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Dimmi cosa funziona, cosa manca o cosa migliorare…"
        placeholderTextColor={colors.textDim}
        multiline
        textAlignVertical="top"
        maxLength={2000}
        style={styles.input}
      />
      {isGuest ? (
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Email (opzionale, per una risposta)"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.emailInput}
        />
      ) : accountEmail ? (
        <Text style={styles.hint}>Risponderemo a {accountEmail}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={() => void submit()}
        disabled={sending}
        style={({ pressed }) => [styles.btn, (pressed || sending) && { opacity: 0.88 }]}
      >
        {sending ? (
          <ActivityIndicator color="#041018" size="small" />
        ) : (
          <Text style={styles.btnText}>Invia feedback</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.22)",
    backgroundColor: "rgba(8,20,40,0.92)"
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  input: {
    minHeight: 96,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  emailInput: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: colors.text,
    fontSize: 14
  },
  hint: {
    color: colors.textDim,
    fontSize: 11
  },
  error: {
    color: colors.danger,
    fontSize: 12
  },
  btn: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan
  },
  btnText: {
    color: "#041018",
    fontSize: 14,
    fontWeight: "800"
  },
  ghostBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  ghostBtnText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  }
});
