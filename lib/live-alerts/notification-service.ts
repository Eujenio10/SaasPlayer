import { listPushTokens } from "@/lib/notifications/repository";
import { sendExpoPushMessages } from "@/lib/notifications/expo-push";
import type { ExpoPushMessage } from "@/lib/notifications/types";
import { missedNotificationBody, reachedNotificationBody } from "@/lib/live-alerts/copy";
import type { MatchAlertRow } from "@/lib/live-alerts/types";

export async function sendLiveAlertNotifications(
  alerts: MatchAlertRow[],
  kind: "reached" | "missed"
): Promise<number> {
  if (!alerts.length) return 0;
  const tokens = await listPushTokens();
  const byUser = new Map<string, string[]>();
  for (const token of tokens) {
    const list = byUser.get(token.userId) ?? [];
    list.push(token.expoPushToken);
    byUser.set(token.userId, list);
  }

  const messages: ExpoPushMessage[] = [];
  for (const alert of alerts) {
    const dest = byUser.get(alert.userId) ?? [];
    const body = kind === "reached" ? reachedNotificationBody(alert) : missedNotificationBody();
    for (const to of dest) {
      messages.push({
        to,
        title: "PitchBrain Live Alerts",
        body,
        data: {
          type: "live_alert",
          eventId: String(alert.fixtureId),
          matchupId: alert.id,
          home: "",
          away: "",
          competition: "",
          homeTeamId: "",
          awayTeamId: "",
          startTimestamp: ""
        },
        sound: "default",
        channelId: "pitchbrain",
        priority: "high"
      });
    }
  }
  const result = await sendExpoPushMessages(messages);
  console.log("[live-alerts] notifications", {
    kind,
    alerts: alerts.length,
    sent: result.sent,
    failed: result.failed
  });
  return result.sent;
}
