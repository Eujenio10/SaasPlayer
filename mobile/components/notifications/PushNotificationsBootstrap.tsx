import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { syncExpoPushToken } from "@/lib/notifications/register";

function hrefFromNotification(data: Record<string, unknown> | undefined): Href | null {
  if (!data) return null;
  const type = String(data.type ?? "");
  const eventId = String(data.eventId ?? "");
  const matchupId = String(data.matchupId ?? "");
  if (type === "key_matchup" && matchupId) {
    return { pathname: "/marking/[matchupId]", params: { matchupId } };
  }
  if (!eventId) return null;
  return {
    pathname: "/match/[eventId]",
    params: {
      eventId,
      home: String(data.home ?? ""),
      away: String(data.away ?? ""),
      competition: String(data.competition ?? ""),
      homeTeamId: String(data.homeTeamId ?? ""),
      awayTeamId: String(data.awayTeamId ?? ""),
      startTimestamp: String(data.startTimestamp ?? "")
    }
  };
}

export function PushNotificationsBootstrap() {
  const { session } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const lastTokenUser = useRef<string | null>(null);
  const lastHandledId = useRef<string | null>(null);

  const openFromNotification = useCallback(
    (data: Record<string, unknown> | undefined, identifier?: string) => {
      if (identifier) {
        if (lastHandledId.current === identifier) return;
        lastHandledId.current = identifier;
      }
      const href = hrefFromNotification(data);
      if (href) router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    const userId = session?.user.id ?? null;
    if (!userId) {
      lastTokenUser.current = null;
      return;
    }
    if (lastTokenUser.current === userId) return;
    lastTokenUser.current = userId;
    void syncExpoPushToken(locale).catch(() => undefined);
  }, [locale, session?.user.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        openFromNotification(
          response.notification.request.content.data as Record<string, unknown>,
          response.notification.request.identifier
        );
      })
      .catch(() => undefined);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(
        response.notification.request.content.data as Record<string, unknown>,
        response.notification.request.identifier
      );
    });
    return () => sub.remove();
  }, [openFromNotification, router]);

  return null;
}
