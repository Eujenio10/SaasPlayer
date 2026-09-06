export type TeamNotificationType = "match_preview" | "key_matchup";

export interface FollowedTeamRow {
  userId: string;
  teamId: number;
  teamName: string | null;
  competitionId: string | null;
}

export interface NotificationPreferenceRow {
  userId: string;
  matchPreviewEnabled: boolean;
  matchupEnabled: boolean;
}

export interface PushTokenRow {
  userId: string;
  expoPushToken: string;
  platform: string | null;
  locale: string | null;
}

export interface TeamNotificationPayload {
  type: TeamNotificationType;
  eventId: string;
  matchupId?: string;
  home: string;
  away: string;
  competition: string;
  homeTeamId: string;
  awayTeamId: string;
  startTimestamp: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: TeamNotificationPayload;
  sound: "default";
  channelId: "pitchbrain";
  priority?: "high";
}
