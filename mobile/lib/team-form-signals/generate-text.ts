import type { MainSignalKind, SignalScore, SignalReliability, TrendDirection } from "./types";
import { levelLabelItalian } from "./normalize";

export function shotShortText(score: SignalScore): string {
  if (score.level === "high") return "Volume offensivo sopra media";
  if (score.level === "medium_high") return "Buon volume di conclusioni";
  if (score.level === "medium") return "Profilo tiri nella media";
  return "Volume tiri contenuto";
}

export function cornerShortText(score: SignalScore): string {
  if (score.level === "high") return "Spinta laterale elevata";
  if (score.level === "medium_high") return "Buona spinta laterale";
  if (score.level === "medium") return "Corner nella media torneo";
  return "Profilo corner contenuto";
}

export function cardShortText(score: SignalScore): string {
  if (score.level === "high") return "Profilo disciplinare sopra media";
  if (score.level === "medium_high") return "Contatti e cartellini elevati";
  if (score.level === "medium") return "Profilo disciplinare nella media";
  return "Profilo disciplinare contenuto";
}

export function resolveMainSignal(
  shot: SignalScore,
  corner: SignalScore,
  card: SignalScore
): { mainSignal: MainSignalKind; mainSignalLabel: string; overallSignalScore: number } {
  const max = Math.max(shot.score, corner.score, card.score);
  if (max < 60) {
    return { mainSignal: "none", mainSignalLabel: "Nessun segnale forte", overallSignalScore: max };
  }
  if (shot.score >= corner.score && shot.score >= card.score) {
    return { mainSignal: "shots", mainSignalLabel: "Tiri alti", overallSignalScore: shot.score };
  }
  if (corner.score >= card.score) {
    return { mainSignal: "corners", mainSignalLabel: "Corner alti", overallSignalScore: corner.score };
  }
  return { mainSignal: "cards", mainSignalLabel: "Cartellini alti", overallSignalScore: card.score };
}

export function buildMainExplanation(
  mainSignal: MainSignalKind,
  shot: SignalScore,
  corner: SignalScore,
  card: SignalScore,
  reliability: SignalReliability
): string {
  let text = "";

  if (mainSignal === "none") {
    text =
      "La partita non mostra segnali statistici particolarmente elevati. I valori principali restano vicini alla media del torneo.";
  } else if (mainSignal === "shots" || shot.score >= 75) {
    text =
      "Il match mostra un profilo favorevole a un volume elevato di conclusioni: le squadre coinvolte producono e concedono tiri sopra la media del torneo.";
  } else if (mainSignal === "corners" || corner.score >= 75) {
    text =
      "Il segnale corner è elevato: i dati indicano una combinazione tra produzione laterale, corner guadagnati e corner concessi dall'avversario.";
  } else if (mainSignal === "cards" || card.score >= 75) {
    text =
      "Il profilo disciplinare del match è sopra media: le squadre mostrano valori elevati nei dati relativi a cartellini, falli e intensità di gioco.";
  } else if (mainSignal === "shots") {
    text =
      "Il segnale statistico sui tiri è medio-alto: entrambe le squadre combinano produzione e concessioni sopra la media di riferimento.";
  } else if (mainSignal === "corners") {
    text =
      "I dati corner segnalano una tendenza sopra media, con buona spinta laterale e volume di angoli attesi.";
  } else {
    text =
      "Il profilo disciplinare segnala valori sopra media nei falli e nell'intensità di contatto attesa.";
  }

  if (reliability.level === "low") {
    text += " La lettura va interpretata con cautela perché alcuni dati sono parziali o il campione disponibile è ridotto.";
  }

  return text;
}

export function buildKeyFactors(input: {
  shot: SignalScore;
  corner: SignalScore;
  card: SignalScore;
  shotsForAbove: boolean;
  shotsAgainstAbove: boolean;
  cornersAbove: boolean;
  cardsAbove: boolean;
  bothTeamsOffensive: boolean;
  reliability: SignalReliability;
}): string[] {
  const factors: string[] = [];

  if (input.shotsForAbove) factors.push("Tiri prodotti sopra la media torneo");
  if (input.shotsAgainstAbove) factors.push("Tiri concessi sopra la media torneo");
  if (input.bothTeamsOffensive) factors.push("Entrambe le squadre generano volume offensivo");
  if (input.corner.score >= 60) factors.push("Profilo corner sopra la media di riferimento");
  if (input.card.score >= 60) factors.push("Contatti e falli sopra la media attesa");
  if (input.shot.score >= 60 && input.corner.score >= 60) {
    factors.push("Ritmo recente più alto della media");
  }
  if (input.reliability.level === "medium") {
    factors.push("Affidabilità media per campione dati parziale");
  }
  if (input.reliability.level === "low") {
    factors.push("Affidabilità bassa: interpretare con cautela");
  }

  if (!factors.length) {
    factors.push("Valori principali allineati alla media del torneo");
    factors.push("Nessun indicatore nettamente sopra soglia");
  }

  return factors.slice(0, 5);
}

export function trendFromRatio(recent: number, season: number): TrendDirection {
  if (!Number.isFinite(recent) || !Number.isFinite(season) || season <= 0) return "unknown";
  const ratio = recent / season;
  if (ratio >= 1.08) return "up";
  if (ratio <= 0.92) return "down";
  return "stable";
}

export function trendLabelItalian(trend: TrendDirection): string {
  if (trend === "up") return "in crescita";
  if (trend === "down") return "in calo";
  if (trend === "stable") return "stabile";
  return "non disponibile";
}

export function buildTrendText(
  shotsTrend: TrendDirection,
  cornersTrend: TrendDirection,
  cardsTrend: TrendDirection
): string {
  const parts: string[] = [];

  if (shotsTrend === "up") {
    parts.push("nelle ultime partite il volume tiri è superiore alla media stagionale");
  } else if (shotsTrend === "down") {
    parts.push("il volume tiri recente è sotto la media stagionale");
  } else if (shotsTrend === "stable") {
    parts.push("il profilo tiri resta stabile rispetto alla stagione");
  }

  if (cornersTrend === "up") {
    parts.push("i corner mostrano una tendenza in crescita");
  } else if (cornersTrend === "stable") {
    parts.push("il profilo corner resta stabile");
  } else if (cornersTrend === "down") {
    parts.push("i corner recenti sono sotto la media stagionale");
  }

  if (cardsTrend === "up") {
    parts.push("il profilo disciplinare è in aumento nei dati recenti");
  } else if (cardsTrend === "stable") {
    parts.push("cartellini e falli restano in linea con la stagione");
  }

  if (!parts.length) {
    return "Trend recente non calcolabile con il campione disponibile.";
  }

  const joined = parts.slice(0, 3).join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

export function reliabilityBadgeColor(level: SignalReliability["level"]): string {
  if (level === "high") return "#6EE7B7";
  if (level === "medium") return "#FCD34D";
  return "#FB7185";
}

export function levelBadgeColor(level: SignalScore["level"]): string {
  if (level === "high") return "rgba(103,232,249,0.18)";
  if (level === "medium_high") return "rgba(56,189,248,0.12)";
  if (level === "medium") return "rgba(148,163,184,0.12)";
  return "rgba(110,231,183,0.1)";
}

export { levelLabelItalian };
