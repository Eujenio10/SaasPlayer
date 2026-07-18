/**
 * Analisi di Campo — Generazione testi (italiano)
 *
 * Costruisce titolo, significato tattico, sintesi, evidence e keyStats per
 * ogni insight. Stile professionale e tecnico. Nessun riferimento a esiti,
 * scommesse o pronostici.
 */

import { isFiniteNumber, round } from "./fieldAnalysis.scoring";
import type {
  CategoryResult,
  KeyStat,
  MetricBreakdown,
  MetricDirection
} from "./fieldAnalysis.types";

/* ------------------------------------------------------------------ */
/* Parole vietate (guardia di sicurezza)                               */
/* ------------------------------------------------------------------ */

export const FORBIDDEN_WORDS = [
  "pronostico",
  "puntata",
  "quota",
  "giocata",
  "betting",
  "sicuro",
  "garantito",
  "da giocare",
  "entra",
  "conviene"
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ritorna le parole vietate trovate nel testo, usando confini di parola per
 * evitare falsi positivi (es. "centrale" non deve far scattare "entra").
 */
export function findForbiddenWords(text: string): string[] {
  return FORBIDDEN_WORDS.filter((word) => {
    const pattern = new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, "iu");
    return pattern.test(text);
  });
}

/* ------------------------------------------------------------------ */
/* Interpretazioni sintetiche                                          */
/* ------------------------------------------------------------------ */

export function interpretationFromNormalized(
  normalized: number | undefined,
  direction: MetricDirection
): string {
  if (!isFiniteNumber(normalized)) return "dato non confrontabile";

  if (direction === "weakness") {
    if (normalized >= 1.31) return "vulnerabilità marcata sopra la media";
    if (normalized >= 1.11) return "vulnerabilità sopra la media";
    if (normalized >= 0.96) return "in linea con la media";
    if (normalized >= 0.76) return "tendenzialmente solido";
    return "molto solido";
  }

  if (normalized >= 1.31) return "ben sopra la media";
  if (normalized >= 1.11) return "sopra la media";
  if (normalized >= 0.96) return "in linea con la media";
  if (normalized >= 0.76) return "sotto la media";
  return "ben sotto la media";
}

function formatValue(value: number | string | undefined): number | string {
  if (value == null) return "n.d.";
  if (typeof value === "string") return value;
  return round(value, 2);
}

/* ------------------------------------------------------------------ */
/* Descrittori testuali per categoria                                  */
/* ------------------------------------------------------------------ */

type CategoryText = {
  title: (team: string, opponent: string) => string;
  tacticalMeaning: (team: string, opponent: string) => string;
  summary: (team: string, opponent: string) => string;
};

export const CATEGORY_TEXT: Record<string, CategoryText> = {
  right_flank_mismatch: {
    title: (t) => `Fascia destra favorevole a ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} può creare vantaggio sviluppando il gioco sulla propria destra, dove ${o} mostra fragilità difensive.`,
    summary: (t, o) =>
      `${t} attacca con continuità dalla corsia destra, con buona produzione di cross e progressioni. ${o} concede spazi, cross e duelli sulla propria fascia sinistra difensiva.`
  },
  left_flank_mismatch: {
    title: (t) => `Fascia sinistra favorevole a ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} può trovare superiorità sulla propria sinistra, dove ${o} difende con minore solidità.`,
    summary: (t, o) =>
      `${t} sviluppa molte azioni dalla corsia sinistra con cross e conduzioni. ${o} appare più esposta sulla propria fascia destra difensiva.`
  },
  central_creation_mismatch: {
    title: (t) => `Rifinitura centrale a favore di ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} può rifinire tra le linee e servire l'area, mentre ${o} concede passaggi e duelli nella zona centrale.`,
    summary: (t, o) =>
      `${t} produce volume di gioco centrale, con passaggi nell'ultimo terzo e verso l'area. ${o} mostra permeabilità tra centrocampo e difesa nella zona nevralgica.`
  },
  box_presence_mismatch: {
    title: (t) => `Presenza in area dominante per ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} arriva con frequenza e qualità in area, dove ${o} fatica a proteggere la propria zona di rifinitura.`,
    summary: (t, o) =>
      `${t} accumula tocchi in area, tiri dalla corta distanza e grandi occasioni. ${o} concede volume e qualità nei pressi della propria porta.`
  },
  set_piece_mismatch: {
    title: (t) => `Palle inattive a favore di ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} è pericolosa sui calci piazzati, situazione in cui ${o} mostra difficoltà difensive.`,
    summary: (t, o) =>
      `${t} genera occasioni da corner e punizioni con buona presenza aerea. ${o} concede tiri e duelli aerei sulle palle inattive.`
  },
  outside_shot_mismatch: {
    title: (t) => `Conclusioni dalla distanza per ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} calcia volentieri da fuori area, mentre ${o} tende a concedere lo spazio per il tiro dalla distanza.`,
    summary: (t, o) =>
      `${t} cerca con frequenza la conclusione da fuori area con discreta precisione. ${o} lascia tirare dalla media distanza più della media.`
  },
  shot_quality_mismatch: {
    title: (t) => `Qualità delle occasioni a favore di ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} costruisce tiri di qualità elevata, in un contesto in cui ${o} concede occasioni pulite.`,
    summary: (t, o) =>
      `${t} produce un xG per tiro elevato e una quota alta di grandi occasioni. ${o} concede conclusioni di buona qualità e da posizioni centrali.`
  },
  offensive_pressure_mismatch: {
    title: (t) => `Pressione offensiva sostenuta di ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} produce volume offensivo continuo, mentre ${o} subisce molte conclusioni e ingressi in area.`,
    summary: (t, o) =>
      `${t} genera tiri, corner e ingressi in area con regolarità. ${o} concede volume di gioco offensivo sopra la media.`
  },
  pressing_mismatch: {
    title: (t) => `Pressing e recuperi alti per ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} aggredisce in alto e recupera palloni avanzati, mentre ${o} tende a perdere il possesso nella propria metà campo.`,
    summary: (t, o) =>
      `${t} mostra un PPDA basso, molti recuperi alti e pressione nell'ultimo terzo. ${o} perde palloni nella propria trequarti ed è costretta al lancio lungo.`
  },
  transition_mismatch: {
    title: (t) => `Transizioni offensive a favore di ${t}`,
    tacticalMeaning: (t, o) =>
      `${t} è efficace nelle ripartenze, mentre ${o} concede occasioni dopo recupero e attacchi diretti.`,
    summary: (t, o) =>
      `${t} crea tiri e occasioni dopo recupero palla con attacchi diretti. ${o} è vulnerabile nelle transizioni difensive e perde palloni in posizione rischiosa.`
  },
  discipline_contacts_mismatch: {
    title: (t, o) => `Partita di contatti nella metà campo di ${o}`,
    tacticalMeaning: (t, o) =>
      `${t} subisce molti contatti in zone avanzate e ${o} commette falli e accumula cartellini con frequenza: possibile gara fisica e spezzettata.`,
    summary: (t, o) =>
      `${t} guadagna falli nella trequarti offensiva grazie a dribbling e duelli vinti. ${o} commette molti falli nella propria metà campo e raccoglie cartellini sopra la media.`
  },
  player_dependency_mismatch: {
    title: (t) => `Dipendenza offensiva di ${t} da un riferimento`,
    tacticalMeaning: (t) =>
      `La produzione offensiva di ${t} è concentrata su un singolo riferimento: il suo rendimento condiziona molto la fase offensiva.`,
    summary: (t) =>
      `Una parte rilevante di tiri, xG e creazione di occasioni di ${t} dipende da un solo giocatore: un fattore da monitorare in base a impiego e condizione.`
  },
  lineup_impact_mismatch: {
    title: (t) => `Impatto formazione e assenze per ${t}`,
    tacticalMeaning: (t) =>
      `Le scelte di formazione e le assenze di ${t} modificano l'equilibrio tecnico della partita in alcune zone del campo.`,
    summary: (t) =>
      `Assenze e variazioni di modulo di ${t} incidono su fasce, palle inattive o creatività: le letture vanno aggiornate di conseguenza.`
  }
};

const DEFAULT_TEXT: CategoryText = {
  title: (t) => `Vantaggio tecnico per ${t}`,
  tacticalMeaning: (t, o) => `${t} mostra un vantaggio tecnico rispetto a ${o} in quest'area.`,
  summary: (t, o) => `${t} esprime valori superiori a ${o} nelle metriche analizzate per questa categoria.`
};

/* ------------------------------------------------------------------ */
/* buildInsightText                                                    */
/* ------------------------------------------------------------------ */

export type InsightText = {
  title: string;
  tacticalMeaning: string;
  summary: string;
};

export function buildInsightText(result: CategoryResult): InsightText {
  const text = CATEGORY_TEXT[result.category] ?? DEFAULT_TEXT;
  return {
    title: text.title(result.team, result.opponent),
    tacticalMeaning: text.tacticalMeaning(result.team, result.opponent),
    summary: text.summary(result.team, result.opponent)
  };
}

/* ------------------------------------------------------------------ */
/* buildEvidence                                                       */
/* ------------------------------------------------------------------ */

function topMetric(
  metrics: MetricBreakdown[],
  direction: MetricDirection
): MetricBreakdown | undefined {
  return metrics
    .filter((m) => m.direction === direction)
    .sort((a, b) => b.score - a.score)[0];
}

export function buildEvidence(result: CategoryResult): string[] {
  const evidence: string[] = [];

  const topStrength = topMetric(result.keyMetrics, "strength");
  if (topStrength) {
    evidence.push(
      `${result.team}: ${topStrength.metric} ${interpretationFromNormalized(topStrength.normalized, "strength")}.`
    );
  }

  const topWeakness = topMetric(result.keyMetrics, "weakness");
  if (topWeakness) {
    evidence.push(
      `${result.opponent}: ${topWeakness.metric} ${interpretationFromNormalized(topWeakness.normalized, "weakness")}.`
    );
  }

  const sources = new Set(result.keyMetrics.map((m) => m.source));
  if (sources.has("last5") || sources.has("last10")) {
    evidence.push("Indicazione supportata da dati recenti oltre che stagionali.");
  } else {
    evidence.push("Indicazione basata principalmente sui dati stagionali.");
  }

  if (result.keyMetrics.some((m) => m.source === "opponentAdjusted")) {
    evidence.push("Valori corretti per la forza degli avversari affrontati.");
  }

  for (const warning of result.warnings) {
    evidence.push(warning);
  }

  return evidence;
}

/* ------------------------------------------------------------------ */
/* buildKeyStats                                                       */
/* ------------------------------------------------------------------ */

export function buildKeyStats(result: CategoryResult, maxStats = 4): KeyStat[] {
  const ordered = [...result.keyMetrics].sort((a, b) => b.score - a.score);

  const strengths = ordered.filter((m) => m.direction === "strength").slice(0, 2);
  const weaknesses = ordered.filter((m) => m.direction === "weakness").slice(0, 2);

  const picked: MetricBreakdown[] = [];
  const maxPairs = Math.ceil(maxStats / 2);
  for (let i = 0; i < maxPairs; i += 1) {
    if (strengths[i]) picked.push(strengths[i]);
    if (weaknesses[i]) picked.push(weaknesses[i]);
  }

  return picked.slice(0, maxStats).map((metric) => {
    const subject = metric.direction === "strength" ? result.team : result.opponent;
    return {
      label: `${metric.metric} (${subject})`,
      teamValue: formatValue(metric.value),
      leagueAverage:
        metric.leagueAverage != null ? formatValue(metric.leagueAverage) : undefined,
      interpretation: interpretationFromNormalized(metric.normalized, metric.direction)
    } satisfies KeyStat;
  });
}

/* ------------------------------------------------------------------ */
/* globalSummary                                                       */
/* ------------------------------------------------------------------ */

export function buildGlobalSummary(
  homeTeam: string,
  awayTeam: string,
  topInsights: { title: string; team: string }[]
): string {
  if (!topInsights.length) {
    return `Tra ${homeTeam} e ${awayTeam} non emergono mismatch tecnici sufficientemente netti dai dati disponibili: profili tendenzialmente equilibrati nelle aree analizzate.`;
  }

  const leads = topInsights.slice(0, 3).map((i) => i.title.toLowerCase());
  return `Lettura tecnica di ${homeTeam}-${awayTeam}: i temi più rilevanti riguardano ${leads.join("; ")}. L'analisi evidenzia dove ciascuna squadra può creare vantaggio o soffrire, senza indicazioni di esito.`;
}
