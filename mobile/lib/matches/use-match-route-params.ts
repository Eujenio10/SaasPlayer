import { useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useMemo } from "react";
import { formatMatchDateParts, isMatchTodayRome, teamInitialsFromName } from "@/lib/match-display";
import { translateCompetitionName, translateTeamName } from "@/lib/italian-display";

export type MatchRouteParams = {
  eventId: string;
  home?: string;
  away?: string;
  competition?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  startTimestamp?: string;
};

export function useMatchRouteParams() {
  const params = useLocalSearchParams<MatchRouteParams>();
  const eventId = Number(params.eventId);
  const startTimestamp = useMemo(() => {
    const value = Number(params.startTimestamp);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.startTimestamp]);
  const homeTeamId = useMemo(() => {
    const value = Number(params.homeTeamId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.homeTeamId]);
  const awayTeamId = useMemo(() => {
    const value = Number(params.awayTeamId);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [params.awayTeamId]);

  const homeName = translateTeamName(params.home ?? "");
  const awayName = translateTeamName(params.away ?? "");
  const competitionName = translateCompetitionName(params.competition ?? "Competizione");
  const homeInitials = teamInitialsFromName(homeName || params.home || "");
  const awayInitials = teamInitialsFromName(awayName || params.away || "");

  const kickoffLabel = useMemo(() => {
    if (!startTimestamp) return "";
    const parts = formatMatchDateParts(startTimestamp);
    if (isMatchTodayRome(startTimestamp)) return `Oggi · ${parts.time}`;
    return `${parts.dayMonth} · ${parts.time}`;
  }, [startTimestamp]);

  const kickoffLongLabel = useMemo(() => {
    if (!startTimestamp) return competitionName;
    const parts = formatMatchDateParts(startTimestamp);
    const day = isMatchTodayRome(startTimestamp) ? `Oggi, ${parts.time}` : `${parts.dayMonth}, ${parts.time}`;
    return `${homeInitials} vs ${awayInitials} · ${competitionName} · ${day}`;
  }, [awayInitials, competitionName, homeInitials, startTimestamp]);

  return {
    eventId,
    params,
    startTimestamp,
    homeTeamId,
    awayTeamId,
    homeName: homeName || params.home || "",
    awayName: awayName || params.away || "",
    competitionName,
    homeInitials,
    awayInitials,
    kickoffLabel,
    kickoffLongLabel
  };
}

export function matchChildHref(
  eventId: number,
  screen: "fouls" | "performance" | "prematch",
  params: MatchRouteParams
): Href {
  const pathname =
    screen === "fouls"
      ? "/match/[eventId]/fouls"
      : screen === "performance"
        ? "/match/[eventId]/performance"
        : "/match/[eventId]/prematch";
  return {
    pathname,
    params: {
      eventId: String(eventId),
      home: params.home ?? "",
      away: params.away ?? "",
      competition: params.competition ?? "",
      homeTeamId: params.homeTeamId ?? "",
      awayTeamId: params.awayTeamId ?? "",
      startTimestamp: params.startTimestamp ?? ""
    }
  } as unknown as Href;
}
