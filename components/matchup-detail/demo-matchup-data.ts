import type { MatchupDetailModel } from "./types";

/**
 * Dati dimostrativi (Mancini vs Zaccagni) — struttura e valori di riferimento UI.
 * In produzione si usa `buildMatchupDetailModel` con `TacticalMetrics` reali.
 */
export const MOCK_MATCHUP_DETAIL: MatchupDetailModel = {
  rank: 1,
  subtitle:
    "Possibile scontro in campo tra Gianluca Mancini e Mattia Zaccagni, con profilo da duello tattico sulla stessa fascia.",
  playerA: {
    firstName: "Gianluca",
    lastName: "Mancini",
    team: "AS Roma",
    roleLabel: "DIFENSORE",
    position: "DC",
    accent: "blue"
  },
  playerB: {
    firstName: "Mattia",
    lastName: "Zaccagni",
    team: "Lazio",
    roleLabel: "ATTACCANTE",
    position: "AS",
    accent: "red"
  },
  collisionScore: 82,
  collisionScoreLabel: "Molto alto",
  collisionDescription:
    "Combinazione di falli commessi, falli subiti, dribbling e rischio ammonizione.",
  metrics: [
    {
      id: "fouls_committed",
      label: "Falli commessi a partita",
      valueLeft: 2.2,
      valueRight: 3.0
    },
    {
      id: "fouls_suffered",
      label: "Falli subiti a partita",
      valueLeft: 1.2,
      valueRight: 2.1
    },
    {
      id: "dribbles",
      label: "Dribbling riusciti a partita",
      valueLeft: 1.3,
      valueRight: 2.4
    },
    {
      id: "yellows",
      label: "Ammonizioni a partita",
      valueLeft: 0.3,
      valueRight: 0.4,
      showYellowCards: true
    }
  ],
  heatmap: null,
  reasons: [
    {
      id: "duel",
      title: "Duello diretto sulla fascia",
      description:
        "Entrambi agiscono nella stessa zona laterale, con alta probabilità di marcatura diretta."
    },
    {
      id: "foul_diff",
      title: "Differenza nel subire falli",
      description:
        "Zaccagni subisce molti falli: Mancini è tra i marcatori più probabili e tra i profili più fallosi. Questo aumenta il rischio di interventi irregolari."
    },
    {
      id: "booking",
      title: "Rischio ammonizione elevato",
      description:
        "Lo scontro unisce un profilo che commette molti falli e un avversario che attira contatti: rischio cartellino alto (Gianluca Mancini, Mattia Zaccagni)."
    }
  ],
  updatedAtLabel: "20 apr 2025, 10:15"
};
