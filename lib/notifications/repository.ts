import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { FollowedTeamRow, NotificationPreferenceRow, PushTokenRow, TeamNotificationType } from "@/lib/notifications/types";

export async function listFollowedTeams(): Promise<FollowedTeamRow[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb.from("user_followed_teams").select("user_id, team_id, team_name, competition_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    teamId: Number(row.team_id),
    teamName: typeof row.team_name === "string" ? row.team_name : null,
    competitionId: typeof row.competition_id === "string" ? row.competition_id : null
  })).filter((row) => Number.isFinite(row.teamId) && row.teamId > 0);
}

export async function listNotificationPreferences(): Promise<Map<string, NotificationPreferenceRow>> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("notification_preferences")
    .select("user_id, match_preview_enabled, matchup_enabled");
  if (error) throw new Error(error.message);
  const map = new Map<string, NotificationPreferenceRow>();
  for (const row of data ?? []) {
    map.set(String(row.user_id), {
      userId: String(row.user_id),
      matchPreviewEnabled: row.match_preview_enabled !== false,
      matchupEnabled: row.matchup_enabled !== false
    });
  }
  return map;
}

export async function listPushTokens(): Promise<PushTokenRow[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb.from("user_push_tokens").select("user_id, expo_push_token, platform, locale");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => ({
      userId: String(row.user_id),
      expoPushToken: String(row.expo_push_token ?? "").trim(),
      platform: typeof row.platform === "string" ? row.platform : null,
      locale: typeof row.locale === "string" ? row.locale : null
    }))
    .filter((row) => row.expoPushToken.startsWith("ExponentPushToken[") || row.expoPushToken.startsWith("ExpoPushToken["));
}

export async function listSentKeys(userIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!userIds.length) return keys;
  const sb = createSupabaseServiceClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("sent_notifications")
    .select("user_id, fixture_id, notification_type")
    .in("user_id", userIds)
    .gte("sent_at", since);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    keys.add(`${row.user_id}:${row.fixture_id}:${row.notification_type}`);
  }
  return keys;
}

export function sentKey(userId: string, fixtureId: string, type: TeamNotificationType): string {
  return `${userId}:${fixtureId}:${type}`;
}

export async function recordSentNotification(params: {
  userId: string;
  teamId: number;
  fixtureId: string;
  type: TeamNotificationType;
}): Promise<boolean> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("sent_notifications").insert({
    user_id: params.userId,
    team_id: params.teamId,
    fixture_id: params.fixtureId,
    notification_type: params.type
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

export async function releaseSentNotification(params: {
  userId: string;
  fixtureId: string;
  type: TeamNotificationType;
}): Promise<void> {
  const sb = createSupabaseServiceClient();
  await sb
    .from("sent_notifications")
    .delete()
    .eq("user_id", params.userId)
    .eq("fixture_id", params.fixtureId)
    .eq("notification_type", params.type);
}
