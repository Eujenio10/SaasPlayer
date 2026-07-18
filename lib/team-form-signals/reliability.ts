import type { TeamSignalBundle } from "./build-team-bundle";
import type { SignalReliability, TeamFormDataSource } from "./types";

export function calculateSignalReliability(input: {
  home: TeamSignalBundle | null;
  away: TeamSignalBundle | null;
  hasShotsData: boolean;
  hasFoulsData: boolean;
  hasLast5Samples: boolean;
  dataSource: TeamFormDataSource;
}): SignalReliability {
  const reasons: string[] = [];
  let score = 0;

  if (input.hasShotsData) score += 25;
  else reasons.push("Dati tiri limitati o assenti");

  if (input.hasFoulsData) score += 20;
  else reasons.push("Dati falli/cartellini parziali");

  const homePlayers = input.home?.playerCount ?? 0;
  const awayPlayers = input.away?.playerCount ?? 0;
  if (homePlayers >= 8 && awayPlayers >= 8) score += 15;
  else reasons.push("Campione giocatori ridotto");

  if (input.hasLast5Samples) score += 20;
  else reasons.push("Finestra ultime 5 partite incompleta");

  if (input.dataSource === "blueprint_db") {
    score += 20;
  } else if (input.dataSource === "blueprint_computed") {
    score += 12;
    reasons.push("Statistiche squadra calcolate da metriche giocatore");
  } else {
    score += 6;
    reasons.push("Blueprint squadra non disponibile");
  }

  const totalSample = (input.home?.sampleLast5 ?? 0) + (input.away?.sampleLast5 ?? 0);
  if (totalSample >= 6) score += 10;
  else if (totalSample > 0) {
    score += 4;
    reasons.push("Campione recente parziale");
  } else {
    reasons.push("Nessun campione recente verificabile");
  }

  if (input.home?.hasBlueprint && input.away?.hasBlueprint) score += 10;
  else if (input.home?.hasBlueprint || input.away?.hasBlueprint) {
    score += 4;
    reasons.push("Blueprint disponibile solo per una squadra");
  }

  if (score >= 75) {
    return { level: "high", label: "Alta", reasons: reasons.length ? reasons : ["Dati completi e campione solido"] };
  }
  if (score >= 45) {
    return { level: "medium", label: "Media", reasons: reasons.length ? reasons : ["Lettura utilizzabile con normali riserve"] };
  }
  return { level: "low", label: "Bassa", reasons: reasons.length ? reasons : ["Campione limitato o dati incompleti"] };
}
