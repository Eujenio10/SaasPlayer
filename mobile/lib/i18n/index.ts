import { catalog, type AppLocale } from "@/lib/i18n/catalog";

export type { AppLocale } from "@/lib/i18n/catalog";
export { APP_LOCALES, catalog } from "@/lib/i18n/catalog";

export const LOCALE_BCP47: Record<AppLocale, string> = {
  it: "it-IT",
  en: "en-GB"
};

let activeLocale: AppLocale = "it";

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

export function setActiveLocale(locale: AppLocale): void {
  activeLocale = locale;
}

function lookup(locale: AppLocale, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = catalog[locale];
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function t(
  path: string,
  params?: Record<string, string | number>,
  locale: AppLocale = activeLocale
): string {
  const raw = lookup(locale, path) ?? lookup("it", path) ?? path;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] == null ? `{${key}}` : String(params[key])
  );
}

export function translateIntensityPreviewLabel(label: string, locale: AppLocale = activeLocale): string {
  const map: Record<string, string> = {
    "Intensità non calcolabile": t("intensityPreview.notComputable", undefined, locale),
    "Intensità bassa": t("intensityPreview.low", undefined, locale),
    "Intensità media": t("intensityPreview.medium", undefined, locale),
    "Intensità alta": t("intensityPreview.high", undefined, locale),
    "Intensità molto alta": t("intensityPreview.veryHigh", undefined, locale)
  };
  return map[label] ?? label;
}

const COMPETITION_NAME_MAP: Record<string, "common.worldCup" | "common.worldCupShort"> = {
  "Coppa del Mondo": "common.worldCup",
  "Coppa del Mondo 2026": "common.worldCup",
  Mondiali: "common.worldCupShort"
};

export function translateCompetitionName(name: string, locale: AppLocale = activeLocale): string {
  const key = COMPETITION_NAME_MAP[name];
  if (!key) return name;
  if (name === "Coppa del Mondo 2026" && locale === "en") return "World Cup 2026";
  return t(key, undefined, locale);
}

export function localizedRoleLabel(label: string, locale: AppLocale = activeLocale): string {
  const map: Record<string, string> = {
    Portiere: t("intensity.roleGkS", undefined, locale),
    Difensori: t("intensity.roleDef", undefined, locale),
    Difensore: t("intensity.roleDefS", undefined, locale),
    Attaccanti: t("intensity.roleAtt", undefined, locale),
    Attaccante: t("intensity.roleAttS", undefined, locale),
    Centrocampo: t("intensity.roleMid", undefined, locale),
    Centrocampista: t("intensity.roleMidS", undefined, locale)
  };
  return map[label] ?? label;
}

export function translatePrematchBadge(value: string, locale: AppLocale = activeLocale): string {
  if (locale === "it" || !value) return value;
  const exact: Record<string, string> = {
    Basso: t("prematch.weightLow", undefined, locale),
    Medio: t("prematch.weightMedium", undefined, locale),
    "Medio-alto": t("prematch.weightMediumHigh", undefined, locale),
    Alto: t("prematch.weightHigh", undefined, locale),
    "Partita controllata": t("prematch.typeControlled", undefined, locale),
    "Partita aperta": t("prematch.typeOpen", undefined, locale),
    "Partita di transizione": t("prematch.typeTransition", undefined, locale),
    "Partita da fasce": t("prematch.typeWings", undefined, locale),
    "Partita da palle inattive": t("prematch.typeSetPieces", undefined, locale),
    "Partita equilibrata": t("prematch.typeBalanced", undefined, locale),
    "Zona centrale": t("prematch.zoneCentral", undefined, locale),
    "Area di rigore": t("prematch.zoneBox", undefined, locale),
    Transizioni: t("prematch.zoneTransitions", undefined, locale),
    "Palle inattive": t("prematch.zoneSetPieces", undefined, locale),
    Equilibrio: t("prematch.equilibrio", undefined, locale)
  };
  if (exact[value]) return exact[value]!;
  const left = value.match(/^Fascia sinistra\s+(.+)$/i);
  if (left) return t("prematch.leftFlankOf", { team: left[1]! }, locale);
  const right = value.match(/^Fascia destra\s+(.+)$/i);
  if (right) return t("prematch.rightFlankOf", { team: right[1]! }, locale);
  return value;
}

const PREMATCH_STAT_LABELS: Record<string, string> = {
  "Indice forma reale": "prematch.statRealForm",
  "Tiri totali (stag.)": "prematch.statShotsSeason",
  "Tiri in porta (stag.)": "prematch.statSotSeason",
  "Trend recente tiri": "prematch.statRecentShots",
  "Forza offensiva": "prematch.statOffensive",
  "Tiri totali": "prematch.statShotsTotal",
  "Tiri in area": "prematch.statShotsBox",
  "Grandi occasioni": "prematch.statBigChances",
  "Stabilità difensiva": "prematch.statDefensive",
  "Gol subiti": "prematch.statGoalsConceded",
  "Tiri concessi": "prematch.statShotsConceded",
  "Porta inviolata": "prematch.statCleanSheets",
  "Errori → tiro": "prematch.statErrorsToShot",
  "Indice zona": "prematch.statZoneIndex",
  "Minaccia fasce": "prematch.statWideThreat",
  "Minaccia centrale": "prematch.statCentralThreat",
  Transizioni: "prematch.statTransitions",
  "Ritmo atteso": "prematch.statExpectedTempo",
  "Controllo territoriale": "prematch.statTerritorial",
  "Attività offensiva": "prematch.statActivity",
  "Equilibrio match": "prematch.statMatchBalance",
  "Peso palle inattive": "prematch.statSetPieceWeight",
  Corner: "prematch.statCorners",
  "Minaccia da fermo": "prematch.statDeadBallThreat",
  "Gol da piazzato": "prematch.statSetPieceGoals"
};

export function translatePrematchStatLabel(label: string, locale: AppLocale = activeLocale): string {
  const key = PREMATCH_STAT_LABELS[label];
  return key ? t(key, undefined, locale) : label;
}

export function translatePrematchKeyFactor(value: string, locale: AppLocale = activeLocale): string {
  const map: Record<string, string> = {
    "Transizioni e spazi in ripartenza": t("prematch.keyFactorTransition", undefined, locale),
    "Sviluppo sulle fasce e cross": t("prematch.keyFactorWings", undefined, locale),
    "Corner e situazioni da fermo": t("prematch.keyFactorSetPieces", undefined, locale),
    "Controllo territoriale e gestione del ritmo": t("prematch.keyFactorControl", undefined, locale),
    "Volume di tiri e verticalità": t("prematch.keyFactorVolume", undefined, locale),
    "Equilibrio tra fasi di possesso e momenti di apertura": t("prematch.keyFactorBalance", undefined, locale)
  };
  return map[value] ?? value;
}

const MARKING_REASON_LABELS: Record<string, string> = {
  Motivo: "markings.reasonMotive",
  "Statistiche avversario": "markings.reasonStats",
  "Pressione zona": "markings.reasonZone",
  "Altri giocatori coinvolti": "markings.reasonOthers",
  "Zone di gioco molto sovrapposte": "markings.reasonOverlap",
  "Zone operative compatibili": "markings.reasonCompatible"
};

export function translateMarkingReasonLabel(label: string, locale: AppLocale = activeLocale): string {
  const key = MARKING_REASON_LABELS[label];
  return key ? t(key, undefined, locale) : label;
}

export function translateMarkingReasonDetail(detail: string, locale: AppLocale = activeLocale): string {
  if (locale === "it" || !detail) return detail;
  const stats = detail.match(/^([\d.]+) falli subiti medi · ([\d.]+) dribbling riusciti medi$/);
  if (stats) {
    return t("markings.reasonStatsDetail", { fouls: stats[1]!, dribbles: stats[2]! }, locale);
  }
  const overlap = detail.match(/^Sovrapposizione stimata dell[’'](\d+)%$/);
  if (overlap) return t("markings.reasonOverlapDetail", { pct: overlap[1]! }, locale);
  const compat = detail.match(/^Compatibilità spaziale stimata al (\d+)% \(senza heatmap\)$/);
  if (compat) return t("markings.reasonCompatDetail", { pct: compat[1]! }, locale);
  const also = detail.match(/^(Alta|Media|Bassa) · anche (.+) occupano la stessa fascia$/);
  if (also) {
    const levelMap: Record<string, string> = {
      Alta: t("markingsLabels.high", undefined, locale),
      Media: t("markingsLabels.medium", undefined, locale),
      Bassa: t("markingsLabels.low", undefined, locale)
    };
    return t("markings.reasonAlsoOnFlank", { level: levelMap[also[1]!] ?? also[1]!, names: also[2]! }, locale);
  }
  const exact: Record<string, string> = {
    "Elevato rischio di duelli persi e necessità di interventi fallosi.": t("markings.reasonHighRisk", undefined, locale),
    "Pressione ripetuta sulla zona: duelli e interventi a rischio fallo.": t("markings.reasonMediumRisk", undefined, locale),
    "Matchup da monitorare per dribbling e falli subiti dell’avversario.": t("markings.reasonMonitor", undefined, locale),
    "Matchup da monitorare per dribbling e falli subiti dell'avversario.": t("markings.reasonMonitor", undefined, locale),
    Alta: t("markingsLabels.high", undefined, locale),
    Media: t("markingsLabels.medium", undefined, locale),
    Bassa: t("markingsLabels.low", undefined, locale)
  };
  return exact[detail] ?? detail;
}

export function localizedCompetitionLabel(
  competitionId: string | undefined,
  fallbackLabel: string,
  locale: AppLocale = activeLocale
): string {
  if (competitionId === "world-cup") return t("common.worldCupShort", undefined, locale);
  return translateCompetitionName(fallbackLabel, locale);
}

export function translateSparkNarrative(narrative: string, locale: AppLocale = activeLocale): string {
  if (!narrative) return narrative;
  if (locale === "it") return narrative;

  const flankMarking = narrative.match(
    /^Possibile scontro in campo tra (.+) e (.+), con profilo da duello tattico sulla stessa fascia \(marcatura plausibile\)\.$/
  );
  if (flankMarking) {
    return t("intensity.sparkDuelFlank", { a: flankMarking[1]!, b: flankMarking[2]! }, locale);
  }
  const flank = narrative.match(
    /^Possibile scontro in campo tra (.+) e (.+), con profilo da duello tattico sulla stessa fascia\.$/
  );
  if (flank) {
    return t("intensity.sparkDuelFlankShort", { a: flank[1]!, b: flank[2]! }, locale);
  }
  const simple = narrative.match(/^Possibile scontro in campo tra (.+) e (.+)\.$/);
  if (simple) {
    return t("intensity.sparkDuelSimple", { a: simple[1]!, b: simple[2]! }, locale);
  }
  if (narrative === "Non emerge un avversario con profilo di contrasto particolarmente marcato.") {
    return t("intensity.sparkNoOpponent", undefined, locale);
  }
  if (narrative === "Non emerge un matchup falli davvero rilevante con lo schieramento previsto.") {
    return t("intensity.sparkNoMatchup", undefined, locale);
  }
  return narrative;
}

