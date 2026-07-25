import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useURL } from "expo-linking";
import { createSessionFromAuthUrl } from "@/lib/auth-session-from-url";
import { mapAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/lib/theme";

function buildSyntheticAuthUrl(params: Record<string, string | string[] | undefined>): string | null {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    if (value == null) return [];
    return [[key, Array.isArray(value) ? value[0] : value] as const];
  });
  if (!entries.length) return null;
  const search = new URLSearchParams(entries as [string, string][]).toString();
  return `pitchbrain://auth/callback?${search}`;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const incomingUrl = useURL();
  const params = useLocalSearchParams<{
    next?: string;
    error?: string;
    code?: string;
    token_hash?: string;
    type?: string;
  }>();
  const syntheticUrl = useMemo(() => buildSyntheticAuthUrl(params), [params]);
  const [message, setMessage] = useState("Stiamo confermando il tuo account…");
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled) return;

    async function completeAuth() {
      if (params.error) {
        setMessage("Link non valido o scaduto. Richiedi un nuovo invio dall'app.");
        setTimeout(() => router.replace("/login"), 2500);
        setHandled(true);
        return;
      }

      const url = incomingUrl ?? syntheticUrl;
      if (!url) return;

      try {
        const created = await createSessionFromAuthUrl(url);
        if (!created) {
          setMessage("Link non valido. Torna al login e riprova.");
          setTimeout(() => router.replace("/login"), 2500);
          setHandled(true);
          return;
        }

        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session?.user?.email_confirmed_at) {
          setMessage("Conferma email in corso…");
        }

        const next =
          params.next === "reset-password" ? ("/auth/reset-password" as const) : ("/" as const);
        router.replace(next);
        setHandled(true);
      } catch (error) {
        setMessage(mapAuthError(error instanceof Error ? error : new Error("auth_failed")));
        setTimeout(() => router.replace("/login"), 3000);
        setHandled(true);
      }
    }

    void completeAuth();
  }, [handled, incomingUrl, syntheticUrl, params.error, params.next, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.cyan} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg
  },
  text: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  }
});
