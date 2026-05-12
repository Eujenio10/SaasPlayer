import type { FoulRiskEntry } from "@/lib/foul-risk-analysis";

/**
 * Solo presentazione: mappa `riskScore` dell’algoritmo su scala 0–100 per gauge (nessun ricalcolo del modello).
 */
export function committedRiskScoreForGauge(entry: FoulRiskEntry): number {
  return Math.min(100, Math.max(0, Math.round(entry.riskScore * 17)));
}

export function committedRiskGaugeLabel(score100: number): string {
  if (score100 >= 80) return "Rischio molto alto";
  if (score100 >= 60) return "Rischio alto";
  if (score100 >= 40) return "Rischio medio";
  return "Rischio basso";
}

export function committedRiskGaugeColors(score100: number): { arc: string; label: string } {
  if (score100 >= 80) return { arc: "#ef4444", label: "text-red-300" };
  if (score100 >= 60) return { arc: "#f97316", label: "text-orange-300" };
  if (score100 >= 40) return { arc: "#eab308", label: "text-yellow-200" };
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
