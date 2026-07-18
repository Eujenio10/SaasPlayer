import type {
  PreMatchKeyStat,
  PreMatchKeyZoneSection,
  PreMatchReport,
  PreMatchReportInput,
  PreMatchReportSection,
  PreMatchReportSummary,
  PreMatchSetPiecesSection,
  PreMatchTempoSection
} from "./types";
import {
  assessDataQuality,
  blueprintToDerivedStats,
  computeTeamIndices
} from "./build-snapshot";
import {
  computeMatchIndices,
  keyZoneLabelItalian,
  matchTypeFromIndices,
  matchTypeLabelItalian,
  pickKeyZone,
  setPieceWeightLabel,
  tempoLabelFromScore,
  tempoLabelItalian
} from "./compute-indices";
import { formatDecimal } from "./normalize";

function kickoffLabel(ts: number): string {
  if (!ts) return "Orario da definire";
  return new Date(ts * 1000).toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome"
  });
}

function statRow(label: string, home: number, away: number, suffix = ""): PreMatchKeyStat {
  return {
    label,
    homeValue: `${formatDecimal(home)}${suffix}`,
    awayValue: `${formatDecimal(away)}${suffix}`
  };
}

function buildRealFormSection(
  homeName: string,
  awayName: string,
  homeIdx: ReturnType<typeof computeTeamIndices>,
  awayIdx: ReturnType<typeof computeTeamIndices>,
  home: ReturnType<typeof blueprintToDerivedStats>,
  away: ReturnType<typeof blueprintToDerivedStats>
): PreMatchReportSection {
  const homeOver = home && home.recentShotsBoost > 1.08;
  const awayOver = away && away.recentShotsBoost > 1.08;
  const homeUnder = home && home.recentShotsBoost < 0.92;
  const awayUnder = away && away.recentShotsBoost < 0.92;

  let text = `${homeName} e ${awayName} arrivano al match con profili di forma recente distinti. `;
  if (homeOver) {
    text += `${homeName} mostra segnali di sovra-rendimento recente: volume offensivo in crescita rispetto alla media stagionale. `;
  } else if (homeUnder) {
    text += `${homeName} produce meno tiri del solito nelle ultime uscite, nonostante eventuali risultati apparenti. `;
  }
  if (awayOver) {
    text += `${awayName} ha aumentato la produzione offensiva nelle partite più recenti. `;
  } else if (awayUnder) {
    text += `${awayName} registra un calo di continuità offensiva rispetto al trend stagionale. `;
  }
  if (!homeOver && !homeUnder && !awayOver && !awayUnder) {
    text += "Entrambe le squadre mantengono un andamento coerente con le proprie medie stagionali.";
  }

  return {
    homeScore: homeIdx.realForm,
    awayScore: awayIdx.realForm,
    text: text.trim(),
    keyStats: [
      statRow("Indice forma reale", homeIdx.realForm, awayIdx.realForm, "/100"),
      statRow("Tiri totali (stag.)", home?.shotsTotal ?? 0, away?.shotsTotal ?? 0),
      statRow("Tiri in porta (stag.)", home?.shotsOnTarget ?? 0, away?.shotsOnTarget ?? 0),
      statRow("Trend recente tiri", home?.recentShotsBoost ?? 1, away?.recentShotsBoost ?? 1, "×")
    ]
  };
}

function buildOffensiveSection(
  homeName: string,
  awayName: string,
  homeIdx: ReturnType<typeof computeTeamIndices>,
  awayIdx: ReturnType<typeof computeTeamIndices>,
  home: ReturnType<typeof blueprintToDerivedStats>,
  away: ReturnType<typeof blueprintToDerivedStats>
): PreMatchReportSection {
  const leader =
    homeIdx.offensive > awayIdx.offensive + 8
      ? homeName
      : awayIdx.offensive > homeIdx.offensive + 8
        ? awayName
        : null;

  let text = leader
    ? `${leader} presenta un profilo offensivo più continuo, con maggiore volume e qualità nelle occasioni create. `
    : "Le due squadre mostrano volumi offensivi comparabili, con differenze più evidenti nel modo di arrivare in zona pericolosa. ";

  if (home && away) {
    if (home.shotsInsideBox > away.shotsInsideBox * 1.15) {
      text += `${homeName} entra più spesso in area rispetto all'avversaria. `;
    } else if (away.shotsInsideBox > home.shotsInsideBox * 1.15) {
      text += `${awayName} lavora con maggiore frequenza dentro l'area di rigore. `;
    }
    if (home.wingAttackLeft + home.wingAttackRight > away.wingAttackLeft + away.wingAttackRight) {
      text += `${homeName} distribuisce meglio il gioco sulle fasce.`;
    } else if (away.wingAttackLeft + away.wingAttackRight > home.wingAttackLeft + home.wingAttackRight) {
      text += `${awayName} tende a sviluppare più azioni sulle corsie esterne.`;
    }
  }

  return {
    homeScore: homeIdx.offensive,
    awayScore: awayIdx.offensive,
    text: text.trim(),
    keyStats: [
      statRow("Forza offensiva", homeIdx.offensive, awayIdx.offensive, "/100"),
      statRow("Tiri totali", home?.shotsTotal ?? 0, away?.shotsTotal ?? 0),
      statRow("Tiri in area", home?.shotsInsideBox ?? 0, away?.shotsInsideBox ?? 0),
      statRow("Grandi occasioni", home?.bigChances ?? 0, away?.bigChances ?? 0)
    ]
  };
}

function buildDefensiveSection(
  homeName: string,
  awayName: string,
  homeIdx: ReturnType<typeof computeTeamIndices>,
  awayIdx: ReturnType<typeof computeTeamIndices>,
  home: ReturnType<typeof blueprintToDerivedStats>,
  away: ReturnType<typeof blueprintToDerivedStats>
): PreMatchReportSection {
  let text = "";
  if (home && home.goalsConceded < 1.1) {
    text += `${homeName} subisce pochi gol in media e mantiene una difesa strutturata. `;
  } else if (home) {
    text += `${homeName} concede un volume di occasioni superiore alla media difensiva ideale. `;
  }
  if (away && away.goalsConceded < 1.1) {
    text += `${awayName} limita bene le reti subite, anche quando non domina il possesso. `;
  } else if (away) {
    text += `${awayName} può concedere spazio in zona pericolosa pur limitando il numero complessivo di tiri. `;
  }
  if (!text) {
    text = "I profili difensivi vanno letti sul volume di occasioni concesse e sulla qualità delle zone lasciate libere.";
  }

  return {
    homeScore: homeIdx.defensive,
    awayScore: awayIdx.defensive,
    text: text.trim(),
    keyStats: [
      statRow("Stabilità difensiva", homeIdx.defensive, awayIdx.defensive, "/100"),
      statRow("Gol subiti", home?.goalsConceded ?? 0, away?.goalsConceded ?? 0),
      statRow("Tiri concessi", home?.shotsConceded ?? 0, away?.shotsConceded ?? 0),
      statRow("Porta inviolata", home?.cleanSheets ?? 0, away?.cleanSheets ?? 0),
      statRow("Errori → tiro", home?.errorsToShot ?? 0, away?.errorsToShot ?? 0)
    ]
  };
}

function buildSummary(
  input: PreMatchReportInput,
  indices: PreMatchReport["indices"],
  keyZone: PreMatchKeyZoneSection
): PreMatchReportSummary {
  const matchType = matchTypeFromIndices(indices);
  const tempo = tempoLabelFromScore(indices.matchTempo);
  const controlHome = indices.territorialControlHome;
  const controlAway = indices.territorialControlAway;
  const expectedControlTeam =
    controlHome > controlAway + 10 ? "home" : controlAway > controlHome + 10 ? "away" : "equilibrato";
  const expectedControlTeamName =
    expectedControlTeam === "home"
      ? input.homeTeamName
      : expectedControlTeam === "away"
        ? input.awayTeamName
        : "Equilibrio";

  const keyFactor =
    matchType === "transizione"
      ? "Transizioni e spazi in ripartenza"
      : matchType === "fasce"
        ? "Sviluppo sulle fasce e cross"
        : matchType === "palle_inattive"
          ? "Corner e situazioni da fermo"
          : matchType === "controllata"
            ? "Controllo territoriale e gestione del ritmo"
            : matchType === "aperta"
              ? "Volume di tiri e verticalità"
              : "Equilibrio tra fasi di possesso e momenti di apertura";

  const text = `La partita si presenta come ${matchTypeLabelItalian(matchType).toLowerCase()}, con ritmo ${tempoLabelItalian(tempo).toLowerCase()} e maggiore controllo atteso da ${expectedControlTeamName}. Il fattore più rilevante riguarda ${keyFactor.toLowerCase()}, con attenzione particolare a ${keyZone.zoneLabel.toLowerCase()}.`;

  return {
    matchType,
    matchTypeLabel: matchTypeLabelItalian(matchType),
    expectedTempo: tempo,
    expectedTempoLabel: tempoLabelItalian(tempo),
    expectedControlTeam,
    expectedControlTeamName,
    keyFactor,
    keyZoneLabel: keyZone.zoneLabel,
    text
  };
}

export function generatePreMatchReport(input: PreMatchReportInput): PreMatchReport | null {
  const home = blueprintToDerivedStats(
    input.homeBlueprint,
    true,
    input.homeShotsSeasonAvg,
    input.homeShotsLastFiveAvg
  );
  const away = blueprintToDerivedStats(
    input.awayBlueprint,
    false,
    input.awayShotsSeasonAvg,
    input.awayShotsLastFiveAvg
  );

  const quality = assessDataQuality(home, away);
  if (quality === "insufficient") return null;

  const homeIdx = computeTeamIndices(home, away);
  const awayIdx = computeTeamIndices(away, home);
  const indices = computeMatchIndices(home, away, homeIdx, awayIdx);
  const picked = pickKeyZone(home, away, indices);

  const keyZone: PreMatchKeyZoneSection = {
    zone: picked.zone,
    zoneLabel: keyZoneLabelItalian(picked.zone, input.homeTeamName, input.awayTeamName),
    advantagedTeam: picked.advantaged,
    advantagedTeamName: picked.advantaged === "home" ? input.homeTeamName : input.awayTeamName,
    score: picked.score,
    text:
      picked.zone === "fascia_sinistra_casa" || picked.zone === "fascia_destra_casa"
        ? `La fascia laterale di ${input.homeTeamName} può essere decisiva: da quel lato la squadra concentra buona parte delle azioni offensive, mentre ${input.awayTeamName} mostra maggiore permeabilità sul corridoio opposto.`
        : picked.zone === "centrale"
          ? `Il cuore del campo può orientare la gara: la squadra più efficace tra le linee può impostare il ritmo e alimentare le zone finali.`
          : picked.zone === "area"
            ? `L'area di rigore è il punto nevralgico: la squadra che entra più spesso in zona alta può sfruttare la minore solidità difensiva avversaria.`
            : picked.zone === "transizioni"
              ? `Le transizioni rapide possono fare la differenza: chi recupera palla in campo alto e attacca spazio può punire una difesa non ancora organizzata.`
              : `Le palle inattive possono pesare sul match: corner e calci piazzati offrono occasioni concrete in una gara che potrebbe decidersi su episodi.`,
    keyStats: [
      statRow("Indice zona", picked.advantaged === "home" ? picked.score : 0, picked.advantaged === "away" ? picked.score : 0, "/100"),
      statRow("Minaccia fasce", indices.wideThreatHome, indices.wideThreatAway, "/100"),
      statRow("Minaccia centrale", indices.centralThreatHome, indices.centralThreatAway, "/100"),
      statRow("Transizioni", indices.transitionThreatHome, indices.transitionThreatAway, "/100")
    ]
  };

  const tempo: PreMatchTempoSection = {
    tempoScore: indices.matchTempo,
    tempoLabel: tempoLabelFromScore(indices.matchTempo),
    controlHome: indices.territorialControlHome,
    controlAway: indices.territorialControlAway,
    text:
      indices.territorialControlHome > indices.territorialControlAway + 8
        ? `${input.homeTeamName} dovrebbe guidare il possesso e il controllo territoriale, mentre ${input.awayTeamName} può rendersi pericolosa quando trova spazio in ripartenza.`
        : indices.territorialControlAway > indices.territorialControlHome + 8
          ? `${input.awayTeamName} può impostare il gioco con continuità, ma ${input.homeTeamName} resta in partita sfruttando momenti di verticalità.`
          : `Il controllo del gioco appare equilibrato: entrambe le squadre hanno strumenti per alternare fasi di gestione e momenti di apertura del match.`,
    keyStats: [
      statRow("Ritmo atteso", indices.matchTempo, indices.matchTempo, "/100"),
      statRow("Controllo territoriale", indices.territorialControlHome, indices.territorialControlAway, "/100"),
      statRow("Attività offensiva", home?.activityIndex ?? 0, away?.activityIndex ?? 0),
      statRow("Equilibrio match", indices.matchBalance, indices.matchBalance, "/100")
    ]
  };

  const setWeight = setPieceWeightLabel(indices.setPieceWeight);
  const spHome = indices.setPieceThreatHome;
  const spAway = indices.setPieceThreatAway;
  const setPieces: PreMatchSetPiecesSection = {
    weight: setWeight,
    weightScore: indices.setPieceWeight,
    advantagedTeam:
      spHome > spAway + 8 ? "home" : spAway > spHome + 8 ? "away" : "equilibrato",
    advantagedTeamName:
      spHome > spAway + 8
        ? input.homeTeamName
        : spAway > spHome + 8
          ? input.awayTeamName
          : "Equilibrio",
    vulnerableTeam:
      spHome < spAway - 8 ? "home" : spAway < spHome - 8 ? "away" : "equilibrato",
    vulnerableTeamName:
      spHome < spAway - 8
        ? input.homeTeamName
        : spAway < spHome - 8
          ? input.awayTeamName
          : "Equilibrio",
    text:
      indices.setPieceWeight >= 55
        ? `Le palle inattive possono avere peso ${setWeight.replace("_", "-")}. ${input.homeTeamName} produce ${formatDecimal(home?.corners ?? 0)} corner a partita; ${input.awayTeamName} ne guadagna ${formatDecimal(away?.corners ?? 0)}.`
        : `Il peso delle palle inattive resta contenuto rispetto ad altri fattori di gioco, pur potendo incidere su episoli chiave.`,
    keyStats: [
      statRow("Peso palle inattive", indices.setPieceWeight, indices.setPieceWeight, "/100"),
      statRow("Corner", home?.corners ?? 0, away?.corners ?? 0),
      statRow("Minaccia da fermo", spHome, spAway, "/100"),
      statRow("Gol da piazzato", home?.setPieceGoals ?? 0, away?.setPieceGoals ?? 0)
    ]
  };

  const summary = buildSummary(input, indices, keyZone);

  return {
    matchId: String(input.eventId),
    generatedAt: new Date().toISOString(),
    dataQuality: quality,
    dataQualityNote:
      quality === "partial"
        ? "Analisi basata sui dati disponibili per una o entrambe le squadre."
        : null,
    homeTeamName: input.homeTeamName,
    awayTeamName: input.awayTeamName,
    competitionName: input.competitionName,
    kickoffLabel: kickoffLabel(input.kickoffTimestamp),
    summary,
    realForm: buildRealFormSection(input.homeTeamName, input.awayTeamName, homeIdx, awayIdx, home, away),
    offensiveProfile: buildOffensiveSection(
      input.homeTeamName,
      input.awayTeamName,
      homeIdx,
      awayIdx,
      home,
      away
    ),
    defensiveProfile: buildDefensiveSection(
      input.homeTeamName,
      input.awayTeamName,
      homeIdx,
      awayIdx,
      home,
      away
    ),
    keyZone,
    tempoControl: tempo,
    setPieces,
    indices
  };
}
