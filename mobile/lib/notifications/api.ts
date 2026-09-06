import { env } from "@/lib/env";
import { buildMobileHeaders } from "@/lib/mobile-http";
import type { FavoriteTeam } from "@/lib/favorite-team/types";

export interface NotificationPreferences {
  matchPreviewEnabled: boolean;
  matchupEnabled: boolean;
}

export async function fetchFollowedTeams(): Promise<{ teams: FavoriteTeam[]; preferences: NotificationPreferences }> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/followed-teams`, {
    headers: await buildMobileHeaders(true),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("followed_teams_failed");
  const json = (await res.json()) as {
    teams?: FavoriteTeam[];
    preferences?: NotificationPreferences;
  };
  return {
    teams: Array.isArray(json.teams) ? json.teams : [],
    preferences: {
      matchPreviewEnabled: json.preferences?.matchPreviewEnabled !== false,
      matchupEnabled: json.preferences?.matchupEnabled !== false
    }
  };
}

export async function putFollowedTeams(teams: FavoriteTeam[]): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/followed-teams`, {
    method: "PUT",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify({
      teams: teams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        competitionId: team.competitionId
      }))
    })
  });
  if (!res.ok) throw new Error("followed_teams_save_failed");
}

export async function patchNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/notification-preferences`, {
    method: "PATCH",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify(prefs)
  });
  if (!res.ok) throw new Error("notification_prefs_failed");
  return res.json() as Promise<NotificationPreferences>;
}

export async function registerPushToken(params: {
  expoPushToken: string;
  platform: "ios" | "android";
  locale: "it" | "en";
}): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/push-token`, {
    method: "POST",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error("push_token_failed");
}

export async function deletePushToken(expoPushToken: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/user/push-token`, {
    method: "DELETE",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify({ expoPushToken })
  });
  if (!res.ok) throw new Error("push_token_delete_failed");
}
