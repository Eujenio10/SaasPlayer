import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { AppLocale } from "@/lib/i18n";
import { registerPushToken, deletePushToken } from "@/lib/notifications/api";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });
}

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId?.trim() || Constants.easConfig?.projectId || null;
}

export async function syncExpoPushToken(locale: AppLocale): Promise<void> {
  if (Platform.OS === "web") return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("pitchbrain", {
      name: "PitchBrain",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 80, 180]
    });
  }

  const id = projectId();
  if (!id) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await registerPushToken({
    expoPushToken: token.data,
    platform: Platform.OS === "ios" ? "ios" : "android",
    locale
  });
}

export async function unregisterExpoPushToken(): Promise<void> {
  if (Platform.OS === "web") return;
  const id = projectId();
  if (!id) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  await deletePushToken(token.data);
}
