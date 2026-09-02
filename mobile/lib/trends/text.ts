import type { TrendMetric } from "@/lib/trends/types";
import { LOCALE_BCP47, getActiveLocale, t } from "@/lib/i18n";

export function metricLabelIt(metric: TrendMetric): string {
  if (metric === "shots") return t("trendsExtra.shots");
  if (metric === "shots_on_target") return t("trendsExtra.shotsOnTarget");
  return t("trendsExtra.saves");
}

export function metricUnitIt(metric: TrendMetric): string {
  if (metric === "saves") return t("trendsExtra.savesUnit");
  if (metric === "shots_on_target") return t("trendsExtra.shotsOnTargetUnit");
  return t("trendsExtra.shotsUnit");
}

export function formatRoundLabel(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return raw;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(LOCALE_BCP47[getActiveLocale()], {
    day: "2-digit",
    month: "short"
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}
