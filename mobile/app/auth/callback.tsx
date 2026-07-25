import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useURL } from "expo-linking";
import { createSessionFromAuthParams, parseUrlParams } from "@/lib/auth-session-from-url";
import { mapAuthError } from "@/lib/auth-errors";
import { env } from "@/lib/env";
import { colors, radii, spacing } from "@/lib/theme";

const CALLBACK_TIMEOUT_MS = 8_000;

function flattenSearchParams(
  params: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return flat;
}

function hasAuthParams(params: Record<string, string | undefined>): boolean {
  return Boolean(
    params.code ||
      params.access_token ||
      params.token_hash ||
      params.token ||
      params.error ||
      params.error_description
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const incomingUrl = useURL();
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const routeParams = useMemo(() => flattenSearchParams(params), [params]);
  const [message, setMessage] = useState("Stiamo confermando il tuo account…");
  const [failed, setFailed] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveSourceUrl(): Promise<string | null> {
      for (const delay of [0, 500, 1500]) {
        if (cancelled || completedRef.current) return null;
        if (delay > 0) await sleep(delay);
        const initialUrl = await Linking.getInitialURL();
        const candidate = incomingUrl ?? initialUrl;
        if (candidate) return candidate;
      }
      return incomingUrl ?? null;
    }

    async function completeAuth(sourceUrl: string | null) {
      if (completedRef.current || cancelled) return;

      if (routeParams.error) {
        fail("Link non valido o scaduto. Richiedi un nuovo invio dall'app.");
        return;
      }

      const urlParams = sourceUrl ? parseUrlParams(sourceUrl) : {};
      const merged = { ...urlParams, ...routeParams };

      if (!hasAuthParams(merged)) return;

      try {
        const created = await createSessionFromAuthParams(merged);
        if (!created) {
          fail("Link non valido. Richiedi un nuovo invio dall'app.");
          return;
        }
        const next =
          merged.next === "reset-password" ? ("/auth/reset-password" as const) : ("/" as const);
        completedRef.current = true;
        router.replace(next);
      } catch (error) {
        console.warn("[auth/callback] failed", error);
        fail(mapAuthError(error instanceof Error ? error : new Error("auth_failed")));
      }
    }

    function fail(text: string) {
      setMessage(text);
      setFailed(true);
      completedRef.current = true;
    }

    void (async () => {
      await completeAuth(await resolveSourceUrl());
    })();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeAuth(url);
    });

    const timeoutId = setTimeout(() => {
      if (completedRef.current || cancelled) return;
      fail(
        "Link pitchbrain:// non completato (limite iOS). Richiedi un NUOVO invio email: il link aprirà Safari sul sito PitchBrain. Poi accedi dall'app."
      );
    }, CALLBACK_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [incomingUrl, routeParams, router]);

  const webLogin = env.apiUrl.replace(/\/$/, "") + "/login";

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.cyan} size="large" />
      <Text style={styles.text}>{message}</Text>
      {failed && message.includes("Safari") ? (
        <Pressable style={styles.btn} onPress={() => router.replace("/login")}>
          <Text style={styles.btnText}>Vai al login</Text>
        </Pressable>
      ) : null}
      {failed ? (
        <Pressable
          style={styles.linkBtn}
          onPress={() => void Linking.openURL(webLogin)}
        >
          <Text style={styles.linkText}>Apri login web</Text>
        </Pressable>
      ) : null}
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
  },
  btn: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12
  },
  btnText: {
    color: colors.background,
    fontWeight: "800"
  },
  linkBtn: {
    padding: spacing.sm
  },
  linkText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "600"
  }
});
