/**
 * Mock esclusivamente per sviluppo UI — non usare in produzione.
 * Attivabile con EXPO_PUBLIC_USE_PREMATCH_MOCK=1
 */
import type { PreMatchReport } from "@/lib/prematch-report/types";

export const MOCK_PREMATCH_REPORT: PreMatchReport = {
  matchId: "mock-12345",
  generatedAt: new Date().toISOString(),
  dataQuality: "partial",
  dataQualityNote: "Analisi basata sui dati disponibili (mock dev).",
  homeTeamName: "Squadra Alpha",
  awayTeamName: "Squadra Beta",
  competitionName: "Campionato Demo",
  kickoffLabel: "sab 05 lug, 20:45",
  summary: {
    matchType: "transizione",
    matchTypeLabel: "Controllo + transizioni",
    expectedTempo: "medio_alto",
    expectedTempoLabel: "Medio-alto",
    expectedControlTeam: "home",
    expectedControlTeamName: "Squadra Alpha",
    keyFactor: "Sviluppo sulle fasce",
    keyZoneLabel: "Fascia sinistra Squadra Alpha",
    text:
      "La partita si presenta come una gara a ritmo medio-alto, con la squadra di casa più orientata al controllo territoriale e l'ospite pericolosa nelle transizioni. Il fattore più rilevante riguarda la capacità della squadra di casa di sviluppare gioco sulle fasce."
  },
  realForm: {
    homeScore: 72,
    awayScore: 61,
    text:
      "Squadra Alpha arriva da risultati positivi, ma la forma reale è meno solida: nelle ultime partite ha segnato più di quanto prodotto. Squadra Beta mantiene un andamento più coerente con le proprie medie stagionali.",
    keyStats: [
      { label: "Indice forma reale", homeValue: "72/100", awayValue: "61/100" },
      { label: "Tiri totali (stag.)", homeValue: "14.2", awayValue: "11.8" },
      { label: "Tiri in porta (stag.)", homeValue: "5.1", awayValue: "4.3" },
      { label: "Trend recente tiri", homeValue: "1.12×", awayValue: "0.96×" }
    ]
  },
  offensiveProfile: {
    homeScore: 78,
    awayScore: 64,
    text:
      "Squadra Alpha ha un profilo offensivo più continuo: produce più tiri, entra più spesso in area e crea occasioni con maggiore qualità. Squadra Beta è meno costante nel volume offensivo, ma più diretta in transizione.",
    keyStats: [
      { label: "Indice offensivo", homeValue: "78/100", awayValue: "64/100" },
      { label: "Tiri/partita", homeValue: "14.2", awayValue: "11.8" },
      { label: "Cross/partita", homeValue: "18.5", awayValue: "12.1" },
      { label: "Possesso medio", homeValue: "54%", awayValue: "46%" }
    ]
  },
  defensiveProfile: {
    homeScore: 68,
    awayScore: 71,
    text:
      "Squadra Beta concede pochi tiri complessivi, ma spesso da zone pericolose. Indica una difesa che limita il volume, ma non sempre protegge bene l'area.",
    keyStats: [
      { label: "Indice difensivo", homeValue: "68/100", awayValue: "71/100" },
      { label: "Tiri concessi", homeValue: "10.8", awayValue: "9.4" },
      { label: "Cross concessi", homeValue: "14.2", awayValue: "11.6" },
      { label: "Clean sheet", homeValue: "8", awayValue: "10" }
    ]
  },
  keyZone: {
    zone: "fascia_sinistra_casa",
    zoneLabel: "Fascia sinistra Squadra Alpha",
    advantagedTeam: "home",
    advantagedTeamName: "Squadra Alpha",
    score: 78,
    text:
      "La zona più rilevante sembra essere la fascia sinistra della Squadra Alpha. Da quel lato sviluppa una quota alta delle proprie azioni offensive, mentre la Squadra Beta concede cross e ingressi in area dalla propria destra difensiva.",
    keyStats: [
      { label: "Indice zona", homeValue: "78/100", awayValue: "42/100" },
      { label: "Attacchi fascia sx", homeValue: "38%", awayValue: "22%" },
      { label: "Cross subiti dx", homeValue: "12%", awayValue: "31%" },
      { label: "Ingressi area", homeValue: "8.4", awayValue: "6.1" }
    ]
  },
  tempoControl: {
    tempoScore: 68,
    tempoLabel: "medio_alto",
    controlHome: 62,
    controlAway: 48,
    text:
      "Il ritmo previsto è medio-alto. Squadra Alpha dovrebbe avere più possesso, ma Squadra Beta può rendersi pericolosa quando recupera palla e trova campo aperto.",
    keyStats: [
      { label: "Controllo territoriale", homeValue: "62/100", awayValue: "48/100" },
      { label: "Possesso medio", homeValue: "54%", awayValue: "46%" },
      { label: "Passaggi prog.", homeValue: "42.1", awayValue: "35.8" },
      { label: "Ritmo partita", homeValue: "68/100", awayValue: "68/100" }
    ]
  },
  setPieces: {
    weight: "medio_alto",
    weightScore: 72,
    advantagedTeam: "home",
    advantagedTeamName: "Squadra Alpha",
    vulnerableTeam: "away",
    vulnerableTeamName: "Squadra Beta",
    text:
      "Le palle inattive possono avere un peso medio-alto. Squadra Alpha produce molti corner e ha buona presenza collettiva in area. Squadra Beta concede diverse situazioni da piazzato quando viene schiacciata.",
    keyStats: [
      { label: "Corner guadagnati", homeValue: "6.2", awayValue: "4.1" },
      { label: "Corner concessi", homeValue: "4.0", awayValue: "5.8" },
      { label: "Indice palle inattive", homeValue: "74/100", awayValue: "52/100" },
      { label: "Peso situazioni", homeValue: "72/100", awayValue: "72/100" }
    ]
  },
  indices: {
    realFormHome: 72,
    realFormAway: 61,
    offensiveStrengthHome: 78,
    offensiveStrengthAway: 64,
    defensiveStabilityHome: 68,
    defensiveStabilityAway: 71,
    territorialControlHome: 62,
    territorialControlAway: 48,
    transitionThreatHome: 55,
    transitionThreatAway: 70,
    wideThreatHome: 74,
    wideThreatAway: 48,
    centralThreatHome: 58,
    centralThreatAway: 52,
    setPieceThreatHome: 74,
    setPieceThreatAway: 52,
    setPieceWeight: 72,
    matchTempo: 68,
    matchBalance: 58
  }
};

export function getMockPreMatchReport(eventId: number): PreMatchReport {
  return { ...MOCK_PREMATCH_REPORT, matchId: String(eventId) };
}
