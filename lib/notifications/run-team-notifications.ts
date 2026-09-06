import { resolveProductOrganizationId } from "@/lib/auth/product-organization";
import { loadOrganizationDifficultMarkingsSnapshot } from "@/lib/difficult-markings/snapshot";
import { collectAllPublishedMarkings } from "@/lib/difficult-markings/query";
import { translateTeamName } from "@/lib/italian-sports-display";
import {
  hoursUntilKickoff,
  isKeyMatchupWindow,
  isMatchPreviewWindow,
  keyMatchupCopy,
  matchPreviewCopy,
  pickKeyMatchupForFollowedTeam
} from "@/lib/notifications/copy";
import { sendExpoPushMessages } from "@/lib/notifications/expo-push";
import {
  listFollowedTeams,
  listNotificationPreferences,
  listPushTokens,
  listSentKeys,
  recordSentNotification,
  releaseSentNotification,
  sentKey
} from "@/lib/notifications/repository";
import type { ExpoPushMessage, TeamNotificationType } from "@/lib/notifications/types";
import { loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import type { UpcomingMatchItem } from "@/services/sportapi";

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function matchesForTeam(matches: UpcomingMatchItem[], teamId: number): UpcomingMatchItem[] {
  return matches.filter((match) => match.homeTeam.id === teamId || match.awayTeam.id === teamId);
}

function localeOf(value: string | null | undefined): "it" | "en" {
  return value?.toLowerCase().startsWith("en") ? "en" : "it";
}

export async function runTeamNotificationsTick(): Promise<{
  ok: true;
  followed: number;
  users: number;
  queued: number;
  sent: number;
  failed: number;
}> {
  const organizationId = await resolveProductOrganizationId();
  if (!organizationId) {
    return { ok: true, followed: 0, users: 0, queued: 0, sent: 0, failed: 0 };
  }

  const [follows, preferences, tokens, matches, snapshot] = await Promise.all([
    listFollowedTeams(),
    listNotificationPreferences(),
    listPushTokens(),
    loadOrganizationUpcomingMenuMatches(organizationId),
    loadOrganizationDifficultMarkingsSnapshot(organizationId)
  ]);

  const tokensByUser = new Map<string, typeof tokens>();
  for (const token of tokens) {
    const list = tokensByUser.get(token.userId) ?? [];
    list.push(token);
    tokensByUser.set(token.userId, list);
  }

  const userIds = [...new Set(follows.map((row) => row.userId).filter((id) => tokensByUser.has(id)))];
  const alreadySent = await listSentKeys(userIds);
  const kickoffByFixture = new Map(matches.map((match) => [String(match.eventId), match.startTimestamp]));
  const markings = collectAllPublishedMarkings(snapshot, kickoffByFixture);
  const now = nowUnixSeconds();
  const queued: Array<{
    userId: string;
    teamId: number;
    fixtureId: string;
    type: TeamNotificationType;
    messages: ExpoPushMessage[];
  }> = [];

  for (const follow of follows) {
    const userTokens = tokensByUser.get(follow.userId);
    if (!userTokens?.length) continue;
    const prefs = preferences.get(follow.userId);
    const previewOn = prefs?.matchPreviewEnabled !== false;
    const matchupOn = prefs?.matchupEnabled !== false;
    const teamMatches = matchesForTeam(matches, follow.teamId);

    for (const match of teamMatches) {
      const fixtureId = String(match.eventId);
      const hours = hoursUntilKickoff(match.startTimestamp, now);
      const home = translateTeamName(match.homeTeam.name);
      const away = translateTeamName(match.awayTeam.name);
      const payloadBase = {
        eventId: fixtureId,
        home,
        away,
        competition: match.competitionName,
        homeTeamId: String(match.homeTeam.id),
        awayTeamId: String(match.awayTeam.id),
        startTimestamp: String(match.startTimestamp)
      };

      if (previewOn && isMatchPreviewWindow(hours) && !alreadySent.has(sentKey(follow.userId, fixtureId, "match_preview"))) {
        queued.push({
          userId: follow.userId,
          teamId: follow.teamId,
          fixtureId,
          type: "match_preview",
          messages: userTokens.map((token) => {
            const copy = matchPreviewCopy({ home, away, locale: localeOf(token.locale) });
            return {
              to: token.expoPushToken,
              title: copy.title,
              body: copy.body,
              data: { type: "match_preview", ...payloadBase },
              sound: "default",
              channelId: "pitchbrain",
              priority: "high"
            };
          })
        });
      }

      if (matchupOn && isKeyMatchupWindow(hours) && !alreadySent.has(sentKey(follow.userId, fixtureId, "key_matchup"))) {
        const fixtureMarkups = markings.filter(
          (item) => String(item.eventId) === fixtureId || String(item.fixtureId) === fixtureId
        );
        const key = pickKeyMatchupForFollowedTeam(fixtureMarkups, follow.teamId);
        if (key) {
          queued.push({
            userId: follow.userId,
            teamId: follow.teamId,
            fixtureId,
            type: "key_matchup",
            messages: userTokens.map((token) => {
              const copy = keyMatchupCopy({ home, away, matchup: key, locale: localeOf(token.locale) });
              return {
                to: token.expoPushToken,
                title: copy.title,
                body: copy.body,
                data: { type: "key_matchup", matchupId: key.id, ...payloadBase },
                sound: "default",
                channelId: "pitchbrain",
                priority: "high"
              };
            })
          });
        }
      }
    }
  }

  const uniqueQueued: typeof queued = [];
  const seen = new Set<string>();
  for (const item of queued) {
    const key = sentKey(item.userId, item.fixtureId, item.type);
    if (seen.has(key) || alreadySent.has(key)) continue;
    seen.add(key);
    uniqueQueued.push(item);
  }

  let sent = 0;
  let failed = 0;
  for (const item of uniqueQueued) {
    const inserted = await recordSentNotification({
      userId: item.userId,
      teamId: item.teamId,
      fixtureId: item.fixtureId,
      type: item.type
    });
    if (!inserted) continue;
    const result = await sendExpoPushMessages(item.messages);
    sent += result.sent;
    failed += result.failed;
    if (result.sent === 0) {
      await releaseSentNotification({
        userId: item.userId,
        fixtureId: item.fixtureId,
        type: item.type
      }).catch(() => undefined);
    }
  }

  return {
    ok: true,
    followed: follows.length,
    users: userIds.length,
    queued: uniqueQueued.length,
    sent,
    failed
  };
}
