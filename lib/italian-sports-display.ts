import type { PreMatchReport } from "./prematch-report/types";
import type { TacticalMetrics } from "./types";
import {
  localizeNamedTeam,
  localizeTacticalMetric as localizeTacticalMetricCore,
  localizeTacticalMetrics as localizeTacticalMetricsCore,
  replaceTeamNamesInText,
  translateCompetitionName,
  translateTeamName
} from "./italian-sports-display-core";

export {
  formatPlayerDisplayName,
  localizeUpcomingMatch,
  localizeUpcomingMatches,
  localizeNamedTeam,
  replaceTeamNamesInText,
  roleLabelSingular,
  translateCompetitionName,
  translateCompetitionSlug,
  translatePositionRole,
  translateTeamName
} from "./italian-sports-display-core";

function localizeReportSection<T extends { text: string }>(
  section: T,
  rawHome: string,
  home: string,
  rawAway: string,
  away: string
): T {
  return {
    ...section,
    text: replaceTeamNamesInText(section.text, rawHome, home, rawAway, away)
  };
}

export function localizePreMatchReport(report: PreMatchReport): PreMatchReport {
  const rawHome = report.homeTeamName;
  const rawAway = report.awayTeamName;
  const home = translateTeamName(rawHome);
  const away = translateTeamName(rawAway);
  const competitionName = translateCompetitionName(report.competitionName);

  const summary = {
    ...report.summary,
    expectedControlTeamName: localizeNamedTeam(
      report.summary.expectedControlTeamName,
      rawHome,
      home,
      rawAway,
      away
    ),
    text: replaceTeamNamesInText(report.summary.text, rawHome, home, rawAway, away)
  };

  const keyZone = {
    ...report.keyZone,
    advantagedTeamName: localizeNamedTeam(
      report.keyZone.advantagedTeamName,
      rawHome,
      home,
      rawAway,
      away
    ),
    text: replaceTeamNamesInText(report.keyZone.text, rawHome, home, rawAway, away)
  };

  const setPieces = {
    ...report.setPieces,
    advantagedTeamName: localizeNamedTeam(
      report.setPieces.advantagedTeamName,
      rawHome,
      home,
      rawAway,
      away
    ),
    vulnerableTeamName: localizeNamedTeam(
      report.setPieces.vulnerableTeamName,
      rawHome,
      home,
      rawAway,
      away
    ),
    text: replaceTeamNamesInText(report.setPieces.text, rawHome, home, rawAway, away)
  };

  return {
    ...report,
    homeTeamName: home,
    awayTeamName: away,
    competitionName,
    summary,
    realForm: localizeReportSection(report.realForm, rawHome, home, rawAway, away),
    offensiveProfile: localizeReportSection(report.offensiveProfile, rawHome, home, rawAway, away),
    defensiveProfile: localizeReportSection(report.defensiveProfile, rawHome, home, rawAway, away),
    keyZone,
    tempoControl: localizeReportSection(report.tempoControl, rawHome, home, rawAway, away),
    setPieces
  };
}

export function localizeTacticalMetric(metric: TacticalMetrics): TacticalMetrics {
  return localizeTacticalMetricCore(metric);
}

export function localizeTacticalMetrics(metrics: TacticalMetrics[]): TacticalMetrics[] {
  return localizeTacticalMetricsCore(metrics);
}
