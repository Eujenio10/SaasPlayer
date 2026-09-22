import type { LiveAlertLocale, LiveStatisticName, MatchAlertRow } from "@/lib/live-alerts/types";

const STAT_LABEL: Record<LiveAlertLocale, Record<LiveStatisticName, string>> = {
  it: {
    goal_scored: "gol segnati",
    goal_conceded: "gol subiti",
    red_card: "espulsioni",
    penalty: "rigori",
    shots: "tiri",
    shots_on_target: "tiri nello specchio",
    corners: "corner",
    fouls: "falli",
    yellow_cards: "cartellini",
    goal: "gol",
    assist: "assist",
    card: "cartellini",
    fouls_received: "falli subiti",
    saves: "parate"
  },
  en: {
    goal_scored: "goals scored",
    goal_conceded: "goals conceded",
    red_card: "red cards",
    penalty: "penalties",
    shots: "shots",
    shots_on_target: "shots on target",
    corners: "corners",
    fouls: "fouls",
    yellow_cards: "cards",
    goal: "goals",
    assist: "assists",
    card: "cards",
    fouls_received: "fouls drawn",
    saves: "saves"
  }
};

export function statisticLabel(name: LiveStatisticName, locale: LiveAlertLocale): string {
  return STAT_LABEL[locale][name] ?? name;
}

export function reachedNotificationBody(alert: MatchAlertRow): string {
  const locale = alert.locale === "en" ? "en" : "it";
  const who = alert.subjectName?.trim() || (locale === "en" ? "Subject" : "Soggetto");
  const label = statisticLabel(alert.statisticName, locale);
  const value = Math.round(alert.targetValue);
  if (locale === "en") {
    return `🔔 Alert reached: ${who} reached ${value} ${label}`;
  }
  return `🔔 Alert raggiunto: ${who} ha effettuato ${value} ${label}`;
}

export function missedNotificationBody(): string {
  return "🔔 Alert non raggiunto";
}
