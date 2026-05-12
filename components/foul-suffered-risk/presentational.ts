import type { FoulRiskEntry } from "@/lib/foul-risk-analysis";
import type { TacticalMetrics } from "@/lib/types";

/**
 * Solo presentazione: stessa scala 0–100 usata per i falli commessi (`riskScore` → gauge), senza ricalcolo del modello.
 */
export function sufferedRiskScoreForGauge(entry: FoulRiskEntry): number {
  return Math.min(100, Math.max(0, Math.round(entry.riskScore * 17)));
}

export function sufferedRiskGaugeLabel(score100: number): string {
  if (score100 >= 80) return "Rischio molto alto";
  if (score100 >= 70) return "Rischio alto";
  if (score100 >= 60) return "Rischio medio";
  if (score100 >= 50) return "Rischio medio-basso";
  return "Rischio basso";
}

export function sufferedRiskGaugeColors(score100: number): { arc: string; label: string } {
  if (score100 >= 80) return { arc: "#ef4444", label: "text-red-300" };
  if (score100 >= 70) return { arc: "#f97316", label: "text-orange-300" };
  if (score100 >= 60) return { arc: "#f59e0b", label: "text-amber-200" };
  if (score100 >= 50) return { arc: "#eab308", label: "text-yellow-200" };
  return { arc: "#22c55e", label: "text-emerald-300" };
}

/** Prima frase della giustificazione algoritmica (nessun testo inventato). */
export function firstSentenceFromJustification(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const cut = t.split(/(?<=\.)\s+/)[0];
  return cut && cut.length > 0 ? cut : t.slice(0, 200);
}

export function roleBadgeFromPositionCode(code?: string): string {
  const s = (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (s.length <= 3) return s || "—";
  return s.slice(0, 2);
}

export function badgeVariantFromRole(metric?: TacticalMetrics): "attack" | "other" {
  return metric?.roleIcon === "🎯" ? "attack" : "other";
}
