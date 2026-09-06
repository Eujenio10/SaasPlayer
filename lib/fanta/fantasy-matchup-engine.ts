import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { formatPlayerDisplayName, translateTeamName } from "@/lib/italian-sports-display";
import {
  buildFantaMatchupBriefing,
  defenderLaneForPlayer,
  flattenMatchupBriefing
} from "@/lib/fanta/matchup-briefing";
import { pickPlayerMarking } from "@/lib/fanta/matchup";
import { combineFantaRating } from "@/lib/fanta/rating";
import { fantaRoleLabel } from "@/lib/fanta/roles";
import {
  clampScore,
  findOpponentTeam,
  opponentAttackProfile,
  opponentDefenseProfile,
  scaleScore,
  teamCleanSheetRate,
  teamIdsEqual,
  teamQualityScore
} from "@/lib/fanta/team-context";
import type {
  FantaComputedPlayer,
  FantaMatchupCard,
  FantaMatchupClassification,
  FantaMatchupTone,
  FantaReason,
  FantaRoleGroup
} from "@/lib/fanta/types";

type Locale = "it" | "en";

export interface FantasyMatchupEngineResult {
  matchup_score: number;
  classification: FantaMatchupClassification;
  positive_factors: string[];
  negative_factors: string[];
  headline: string;
  lens: FantaRoleGroup;
  markingOpponentName: string | null;
  dribblesPer90: number | null;
  foulsDrawnPer90: number | null;
}

function classifyMatchup(score: number): FantaMatchupClassification {
  if (score >= 62) return "favorevole";
  if (score <= 42) return "difficile";
  return "neutro";
}

export function classificationToTone(value: FantaMatchupClassification): FantaMatchupTone {
  if (value === "favorevole") return "favorable";
  if (value === "difficile") return "difficult";
  return "neutral";
}

function combineParts(parts: Array<{ w: number; v: number | null }>): number | null {
  const available = parts.filter((row): row is { w: number; v: number } => row.v != null);
  if (!available.length) return null;
  const totalW = available.reduce((sum, row) => sum + row.w, 0);
  return clampScore(available.reduce((sum, row) => sum + row.v * (row.w / totalW), 0));
}

function per90(total: number, minutes: number): number | null {
  if (minutes < 45) return null;
  return (total * 90) / minutes;
}

function samplePer90(
  player: FantaComputedPlayer,
  pick: (row: FantaComputedPlayer["appearances"][number]) => number | null
): number | null {
  const sample = player.appearances.filter((row) => row.minutes >= 15).slice(-8);
  const minutes = sample.reduce((sum, row) => sum + row.minutes, 0);
  const total = sample.reduce((sum, row) => sum + (pick(row) ?? 0), 0);
  return per90(total, minutes);
}

function mantraTokens(mantra: string | null | undefined): string[] {
  return (mantra ?? "")
    .split(/[;,/\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isWideDefender(player: FantaComputedPlayer): boolean {
  return defenderLaneForPlayer(player) === "fullback";
}

function isOffensiveMidfielder(player: FantaComputedPlayer): boolean {
  return mantraTokens(player.mantra).some((token) => token === "T" || token === "A" || token === "W");
}

function isDefensiveMidfielder(player: FantaComputedPlayer): boolean {
  const tokens = mantraTokens(player.mantra);
  return tokens.includes("M") && !tokens.some((token) => token === "T" || token === "A" || token === "W");
}

function copy(locale: Locale) {
  const en = locale === "en";
  return {
    solidDefense: en
      ? "The opponent has one of the more solid defences and concedes few attacking chances."
      : "L'avversario presenta una delle difese più solide e concede poche opportunità offensive.",
    leakyDefense: en
      ? "The opponent concedes many attacking chances."
      : "L'avversario concede molte occasioni offensive.",
    fewShots: en ? "Low volume of shots conceded" : "Basso volume di tiri subiti",
    manyShots: en ? "High volume of shots conceded" : "Alto volume di tiri concessi",
    fewGoalsAgainst: en ? "Few goals conceded" : "Pochi gol subiti",
    manyGoalsAgainst: en ? "Many goals conceded" : "Molti gol subiti",
    cleanSheets: en ? "Frequent clean sheets" : "Molti clean sheet",
    rareCleanSheets: en ? "Rare clean sheets" : "Pochi clean sheet",
    fewChances: en ? "Few chances conceded" : "Poche occasioni concesse",
    manyChances: en ? "Many chances conceded" : "Molte occasioni concesse",
    recentSolid: en ? "Defence has been compact in recent matches" : "Difesa compatta nelle partite recenti",
    recentLeaky: en ? "Defence has conceded more in recent matches" : "Difesa più permeabile nelle partite recenti",
    dribbleThreat: en
      ? "The full-back will face a player heavily oriented to dribbling and individual duels."
      : "Il terzino affronterà un giocatore molto orientato al dribbling e ai duelli individuali.",
    highDribbles: en ? "Will face a wide attacker with a high dribble volume" : "Affronterà un esterno con alto numero di dribbling",
    foulsDrawn: en ? "Opponent draws a lot of fouls" : "Avversario molto falloso subito",
    manyDuels: en ? "High number of individual duels" : "Elevato numero di duelli individuali",
    quietAttacker: en ? "Opponent attacker is less involved in 1v1s" : "Attaccante avversario poco coinvolto nei 1vs1",
    lowDribbles: en ? "Limited dribble threat from the opponent" : "Pochi dribbling dal diretto avversario",
    markingHard: en ? "Difficult marking already flagged vs this attacker" : "Marcatura difficile già segnalata su questo attaccante",
    markingSoft: en ? "Manageable individual marking" : "Marcatura individuale gestibile",
    midChance: en ? "Opponent midfield/defence leaves space for chances" : "Il centrocampo avversario lascia spazi per creare",
    midClosed: en ? "Opponent controls the centre and concedes few chances" : "L'avversario chiude la zona centrale e concede poco",
    ownAttack: en ? "Own team creates a useful attacking volume" : "La propria squadra crea un volume offensivo utile",
    ownAttackLow: en ? "Own team creates fewer chances than usual" : "La propria squadra crea meno occasioni",
    oppAttackHigh: en ? "Opponent attack is highly productive" : "Attacco avversario molto produttivo",
    oppAttackLow: en ? "Opponent attack produces little" : "Attacco avversario poco produttivo",
    manyShotsFor: en ? "High opponent shot volume" : "Alto volume di tiri dell'avversario",
    fewShotsFor: en ? "Low opponent shot volume" : "Basso volume di tiri dell'avversario",
    gkRisk: en
      ? "Reliable goalkeeper, but a demanding matchup against a highly productive attack."
      : "Portiere affidabile ma matchup complesso contro un attacco molto produttivo.",
    gkSafe: en
      ? "The opponent produces few attacking chances."
      : "L'avversario produce poche occasioni offensive.",
    cbFavorable: en
      ? "Favourable matchup for a solid defensive performance."
      : "Matchup favorevole per possibile buon rendimento difensivo.",
    cbDifficult: en
      ? "Opponent with high attacking output: greater risk of defensive difficulties."
      : "Avversario con elevata produzione offensiva: aumenta il rischio di difficoltà difensive.",
    ownTeamTight: en ? "Own team concedes few shots" : "La squadra concede pochi tiri",
    ownTeamOpen: en ? "Own team concedes many shots" : "La squadra concede molti tiri",
    formUp: en ? "Opponent attacking output is rising" : "La produzione offensiva avversaria è in crescita",
    formDown: en ? "Opponent attacking output is cooling" : "La produzione offensiva avversaria è in calo",
    balanced: en ? "No strong statistical edge vs the next opponent." : "Nessun vantaggio statistico netto contro il prossimo avversario.",
    vsDefense: en ? "vs opponent defence" : "vs difesa avversaria",
    vsAttack: en ? "vs opponent attack" : "vs attacco avversario",
    vsMid: en ? "vs opponent midfield" : "vs centrocampo avversario"
  };
}

function pushUnique(list: string[], value: string | null | undefined): void {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function scoreForward(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens" | "markingOpponentName" | "dribblesPer90" | "foulsDrawnPer90"> {
  const labels = copy(locale);
  const defense = opponentDefenseProfile(catalog, player.nextOpponentName);
  const ownAttack = teamQualityScore(catalog, player.teamId);
  const parts = [
    { w: 0.3, v: defense.goalsConcededAvg == null ? null : scaleScore(defense.goalsConcededAvg, 0.5, 2.1) },
    { w: 0.2, v: defense.cleanSheetRate == null ? null : clampScore(100 - scaleScore(defense.cleanSheetRate, 0.12, 0.55)) },
    { w: 0.25, v: defense.shotsConcededAvg == null ? null : scaleScore(defense.shotsConcededAvg, 7, 18) },
    { w: 0.15, v: defense.chancesConcededAvg == null ? null : scaleScore(defense.chancesConcededAvg, 4, 14) },
    { w: 0.1, v: defense.leakiness }
  ];
  const score = combineParts(parts) ?? 50;
  const positive: string[] = [];
  const negative: string[] = [];
  if ((defense.goalsConcededAvg ?? 0) >= 1.5) pushUnique(positive, labels.manyGoalsAgainst);
  if ((defense.goalsConcededAvg ?? 99) <= 0.9) pushUnique(negative, labels.fewGoalsAgainst);
  if ((defense.shotsConcededAvg ?? 0) >= 13) pushUnique(positive, labels.manyShots);
  if ((defense.shotsConcededAvg ?? 99) <= 9) pushUnique(negative, labels.fewShots);
  if ((defense.chancesConcededAvg ?? 0) >= 9) pushUnique(positive, labels.manyChances);
  if ((defense.chancesConcededAvg ?? 99) <= 5.5) pushUnique(negative, labels.fewChances);
  if ((defense.cleanSheetRate ?? 0) >= 0.4) pushUnique(negative, labels.cleanSheets);
  if (defense.cleanSheetRate != null && defense.cleanSheetRate <= 0.2) pushUnique(positive, labels.rareCleanSheets);
  if (defense.recentConcededAvg != null && defense.goalsConcededAvg != null) {
    if (defense.recentConcededAvg > defense.goalsConcededAvg + 0.25) pushUnique(positive, labels.recentLeaky);
    if (defense.recentConcededAvg < defense.goalsConcededAvg - 0.25) pushUnique(negative, labels.recentSolid);
  }
  if ((ownAttack ?? 50) >= 62) pushUnique(positive, labels.ownAttack);
  if ((ownAttack ?? 50) <= 40) pushUnique(negative, labels.ownAttackLow);
  const headline =
    score >= 62 ? labels.leakyDefense : score <= 42 ? labels.solidDefense : labels.balanced;
  if (score >= 62) pushUnique(positive, labels.leakyDefense);
  if (score <= 42) pushUnique(negative, labels.solidDefense);
  return {
    matchup_score: Math.round(score),
    classification: classifyMatchup(score),
    positive_factors: positive.slice(0, 4),
    negative_factors: negative.slice(0, 4),
    headline
  };
}

function threatFromPlayer(player: FantaComputedPlayer): number {
  const dribbles = samplePer90(player, (row) => row.dribbles) ?? 0;
  const shots = samplePer90(player, (row) => row.shots) ?? 0;
  const keys = samplePer90(player, (row) => row.keyPasses) ?? 0;
  return dribbles * 1.4 + shots * 0.6 + keys * 0.5;
}

function pickOpponentThreat(
  catalog: FantaComputedPlayer[],
  opponentName: string | null,
  wide: boolean
): FantaComputedPlayer | null {
  const opponent = findOpponentTeam(catalog, opponentName);
  if (!opponent) return null;
  const pool = catalog.filter((row) => teamIdsEqual(row.teamId, opponent.teamId));
  const roles = wide
    ? pool.filter((row) => row.roleGroup === "forward" || isOffensiveMidfielder(row) || isWideDefender(row))
    : pool.filter((row) => row.roleGroup === "forward");
  const ranked = (roles.length ? roles : pool.filter((row) => row.roleGroup !== "goalkeeper")).sort(
    (a, b) => threatFromPlayer(b) - threatFromPlayer(a)
  );
  return ranked[0] ?? null;
}

function invertedOpponentAttack(catalog: FantaComputedPlayer[], opponentName: string | null): number | null {
  const attack = opponentAttackProfile(catalog, opponentName);
  return combineParts([
    { w: 0.35, v: attack.goalsAvg == null ? null : clampScore(100 - scaleScore(attack.goalsAvg, 0.6, 2.3)) },
    { w: 0.25, v: attack.shotsAvg == null ? null : clampScore(100 - scaleScore(attack.shotsAvg, 8, 19)) },
    { w: 0.2, v: attack.shotsOnTargetAvg == null ? null : clampScore(100 - scaleScore(attack.shotsOnTargetAvg, 3, 8)) },
    { w: 0.2, v: attack.chancesAvg == null ? null : clampScore(100 - scaleScore(attack.chancesAvg, 5, 14)) }
  ]) ?? (attack.quality == null ? null : clampScore(100 - attack.quality));
}

function scoreCentralDefender(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens"> {
  const labels = copy(locale);
  const attack = opponentAttackProfile(catalog, player.nextOpponentName);
  const score = invertedOpponentAttack(catalog, player.nextOpponentName) ?? 50;
  const positive: string[] = [];
  const negative: string[] = [];
  if ((attack.quality ?? 50) >= 66) {
    pushUnique(negative, labels.oppAttackHigh);
    pushUnique(negative, labels.manyShotsFor);
  }
  if ((attack.quality ?? 50) <= 40) {
    pushUnique(positive, labels.oppAttackLow);
    pushUnique(positive, labels.fewShotsFor);
  }
  if ((attack.form ?? 50) >= 60) pushUnique(negative, labels.formUp);
  if ((attack.form ?? 50) <= 40) pushUnique(positive, labels.formDown);
  const headline = score >= 62 ? labels.cbFavorable : score <= 42 ? labels.cbDifficult : labels.balanced;
  if (score >= 62) pushUnique(positive, labels.cbFavorable);
  if (score <= 42) pushUnique(negative, labels.cbDifficult);
  return {
    matchup_score: Math.round(score),
    classification: classifyMatchup(score),
    positive_factors: positive.slice(0, 4),
    negative_factors: negative.slice(0, 4),
    headline,
    markingOpponentName: null,
    dribblesPer90: null,
    foulsDrawnPer90: null
  };
}

function scoreFullback(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  markings: DifficultMarkingMatchup[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens"> {
  const labels = copy(locale);
  const marking = pickPlayerMarking(markings, player.playerId);
  const asDefender = marking && teamIdsEqual(marking.defenderPlayerId, player.playerId) ? marking : null;
  const threat = pickOpponentThreat(catalog, player.nextOpponentName, true);
  const dribbles =
    asDefender?.attackerMetrics.dribblesAttemptedPer90 ??
    asDefender?.attackerMetrics.dribblesSuccessfulPer90 ??
    (threat ? samplePer90(threat, (row) => row.dribbles) : null);
  const foulsDrawn = asDefender?.attackerMetrics.foulsDrawnPer90 ?? null;
  const markingScore = asDefender
    ? clampScore(100 - Math.max(0, Math.min(100, asDefender.difficultMarkingScore)))
    : null;
  const dribbleRisk = dribbles == null ? null : clampScore(100 - scaleScore(dribbles, 1.2, 7.2));
  const foulRisk = foulsDrawn == null ? null : clampScore(100 - scaleScore(foulsDrawn, 0.6, 4.2));
  const involvement =
    threat == null ? null : clampScore(100 - scaleScore(threatFromPlayer(threat), 1.5, 10));
  const score =
    combineParts([
      { w: 0.4, v: markingScore },
      { w: 0.3, v: dribbleRisk },
      { w: 0.15, v: foulRisk },
      { w: 0.15, v: involvement }
    ]) ?? 50;
  const positive: string[] = [];
  const negative: string[] = [];
  const threatName = asDefender
    ? formatPlayerDisplayName(asDefender.attackerPlayerName)
    : threat
      ? threat.playerName
      : null;
  if ((dribbles ?? 0) >= 4.5) {
    pushUnique(negative, labels.highDribbles);
    pushUnique(negative, labels.manyDuels);
  } else if (dribbles != null && dribbles <= 2) {
    pushUnique(positive, labels.lowDribbles);
    pushUnique(positive, labels.quietAttacker);
  }
  if ((foulsDrawn ?? 0) >= 2.4) pushUnique(negative, labels.foulsDrawn);
  if (asDefender && asDefender.difficultMarkingScore >= 62) pushUnique(negative, labels.markingHard);
  if (asDefender && asDefender.difficultMarkingScore <= 42) pushUnique(positive, labels.markingSoft);
  const headline = score <= 42 ? labels.dribbleThreat : score >= 62 ? labels.quietAttacker : labels.balanced;
  return {
    matchup_score: Math.round(score),
    classification: classifyMatchup(score),
    positive_factors: positive.slice(0, 4),
    negative_factors: negative.slice(0, 4),
    headline,
    markingOpponentName: threatName,
    dribblesPer90: dribbles,
    foulsDrawnPer90: foulsDrawn
  };
}

function scoreDefender(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  markings: DifficultMarkingMatchup[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens"> {
  if (isWideDefender(player)) return scoreFullback(player, catalog, markings, locale);
  return scoreCentralDefender(player, catalog, locale);
}

function scoreMidfielder(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens" | "markingOpponentName" | "dribblesPer90" | "foulsDrawnPer90"> {
  const labels = copy(locale);
  const defense = opponentDefenseProfile(catalog, player.nextOpponentName);
  const attack = opponentAttackProfile(catalog, player.nextOpponentName);
  const ownAttack = teamQualityScore(catalog, player.teamId);
  const chanceSpace = combineParts([
    { w: 0.4, v: defense.leakiness },
    { w: 0.3, v: defense.chancesConcededAvg == null ? null : scaleScore(defense.chancesConcededAvg, 4, 14) },
    { w: 0.3, v: defense.shotsConcededAvg == null ? null : scaleScore(defense.shotsConcededAvg, 7, 18) }
  ]);
  const defensiveLoad = attack.quality == null ? null : clampScore(100 - attack.quality);
  let score: number | null;
  if (isOffensiveMidfielder(player)) {
    score = combineParts([
      { w: 0.7, v: chanceSpace },
      { w: 0.3, v: ownAttack }
    ]);
  } else if (isDefensiveMidfielder(player)) {
    score = combineParts([
      { w: 0.65, v: defensiveLoad },
      { w: 0.35, v: chanceSpace }
    ]);
  } else {
    score = combineParts([
      { w: 0.5, v: chanceSpace },
      { w: 0.25, v: ownAttack },
      { w: 0.25, v: defensiveLoad }
    ]);
  }
  const value = score ?? 50;
  const positive: string[] = [];
  const negative: string[] = [];
  if ((chanceSpace ?? 50) >= 62) pushUnique(positive, labels.midChance);
  if ((chanceSpace ?? 50) <= 42) pushUnique(negative, labels.midClosed);
  if ((ownAttack ?? 50) >= 62) pushUnique(positive, labels.ownAttack);
  if ((ownAttack ?? 50) <= 40) pushUnique(negative, labels.ownAttackLow);
  if (isDefensiveMidfielder(player) && (attack.quality ?? 50) >= 66) pushUnique(negative, labels.oppAttackHigh);
  if (isDefensiveMidfielder(player) && (attack.quality ?? 50) <= 40) pushUnique(positive, labels.oppAttackLow);
  const headline = value >= 62 ? labels.midChance : value <= 42 ? labels.midClosed : labels.balanced;
  return {
    matchup_score: Math.round(value),
    classification: classifyMatchup(value),
    positive_factors: positive.slice(0, 4),
    negative_factors: negative.slice(0, 4),
    headline
  };
}

function scoreGoalkeeper(
  player: FantaComputedPlayer,
  catalog: FantaComputedPlayer[],
  locale: Locale
): Omit<FantasyMatchupEngineResult, "lens" | "markingOpponentName" | "dribblesPer90" | "foulsDrawnPer90"> {
  const labels = copy(locale);
  const attack = opponentAttackProfile(catalog, player.nextOpponentName);
  const vs = opponentDefenseProfile(catalog, player.teamName);
  const invertedAttack = combineParts([
    { w: 0.35, v: attack.goalsAvg == null ? null : clampScore(100 - scaleScore(attack.goalsAvg, 0.6, 2.3)) },
    { w: 0.25, v: attack.shotsAvg == null ? null : clampScore(100 - scaleScore(attack.shotsAvg, 8, 19)) },
    { w: 0.2, v: attack.shotsOnTargetAvg == null ? null : clampScore(100 - scaleScore(attack.shotsOnTargetAvg, 3, 8)) },
    { w: 0.2, v: attack.chancesAvg == null ? null : clampScore(100 - scaleScore(attack.chancesAvg, 5, 14)) }
  ]);
  const ownShotsConceded = vs.shotsConcededAvg == null ? null : clampScore(100 - scaleScore(vs.shotsConcededAvg, 7, 18));
  const ownCs = teamCleanSheetRate(catalog, player.teamId);
  const ownSolid = combineParts([
    { w: 0.6, v: ownShotsConceded },
    { w: 0.4, v: ownCs == null ? null : scaleScore(ownCs, 0.12, 0.55) }
  ]);
  const score =
    combineParts([
      { w: 0.7, v: invertedAttack ?? (attack.quality == null ? null : clampScore(100 - attack.quality)) },
      { w: 0.3, v: ownSolid }
    ]) ?? 50;
  const positive: string[] = [];
  const negative: string[] = [];
  if ((attack.quality ?? 50) >= 66) {
    pushUnique(negative, labels.oppAttackHigh);
    pushUnique(negative, labels.manyShotsFor);
  }
  if ((attack.quality ?? 50) <= 40) {
    pushUnique(positive, labels.oppAttackLow);
    pushUnique(positive, labels.fewShotsFor);
  }
  if ((ownShotsConceded ?? 50) >= 62) pushUnique(positive, labels.ownTeamTight);
  if ((ownShotsConceded ?? 50) <= 40) pushUnique(negative, labels.ownTeamOpen);
  if ((attack.form ?? 50) >= 60) pushUnique(negative, labels.formUp);
  if ((attack.form ?? 50) <= 40) pushUnique(positive, labels.formDown);
  const headline = score <= 42 ? labels.gkRisk : score >= 62 ? labels.gkSafe : labels.balanced;
  return {
    matchup_score: Math.round(score),
    classification: classifyMatchup(score),
    positive_factors: positive.slice(0, 4),
    negative_factors: negative.slice(0, 4),
    headline
  };
}

export function evaluateFantasyMatchup(params: {
  player: FantaComputedPlayer;
  catalog: FantaComputedPlayer[];
  markings: DifficultMarkingMatchup[];
  locale?: Locale;
}): FantasyMatchupEngineResult | null {
  const player = params.player;
  if (!player.nextOpponentName) return null;
  const locale = params.locale ?? "it";
  if (player.roleGroup === "goalkeeper") {
    return { ...scoreGoalkeeper(player, params.catalog, locale), lens: "goalkeeper", markingOpponentName: null, dribblesPer90: null, foulsDrawnPer90: null };
  }
  if (player.roleGroup === "defender") {
    return { ...scoreDefender(player, params.catalog, params.markings, locale), lens: "defender" };
  }
  if (player.roleGroup === "midfielder") {
    return { ...scoreMidfielder(player, params.catalog, locale), lens: "midfielder", markingOpponentName: null, dribblesPer90: samplePer90(player, (row) => row.dribbles), foulsDrawnPer90: null };
  }
  return { ...scoreForward(player, params.catalog, locale), lens: "forward", markingOpponentName: null, dribblesPer90: samplePer90(player, (row) => row.dribbles), foulsDrawnPer90: null };
}

function fixtureLabel(player: FantaComputedPlayer): string {
  const opponent = player.nextOpponentName ?? "";
  return opponent ? `${player.teamName} – ${opponent}` : player.teamName;
}

function shotsHint(player: FantaComputedPlayer): number | null {
  const value = samplePer90(player, (row) => row.shots);
  return value == null ? null : Math.round(value * 10) / 10;
}

export function toFantasyMatchupCard(params: {
  player: FantaComputedPlayer;
  catalog: FantaComputedPlayer[];
  result: FantasyMatchupEngineResult;
  locale?: Locale;
}): FantaMatchupCard {
  const locale = params.locale ?? "it";
  const player = params.player;
  const result = params.result;
  const tone = classificationToTone(result.classification);
  const reasons: FantaReason[] = [
    ...(Array.isArray(result.positive_factors) ? result.positive_factors : []).map((text, index) => ({
      code: `plus_${index}`,
      text
    })),
    ...(Array.isArray(result.negative_factors) ? result.negative_factors : []).map((text, index) => ({
      code: `minus_${index}`,
      text
    }))
  ];
  if (!reasons.length) {
    reasons.push({ code: "headline", text: result.headline });
  }
  const opponent = player.nextOpponentName ?? "";
  const threatName = result.markingOpponentName ?? opponent;
  return {
    matchupId: player.playerId,
    eventId: 0,
    playerId: player.playerId,
    playerName: player.playerName,
    teamName: player.teamName,
    roleGroup: player.roleGroup,
    roleLabel: fantaRoleLabel(player.roleGroup, locale),
    mantra: player.mantra,
    nextOpponentName: player.nextOpponentName,
    fixtureLabel: fixtureLabel(player),
    matchupScore: result.matchup_score,
    classification: result.classification,
    tone,
    headline: result.headline,
    positiveFactors: Array.isArray(result.positive_factors) ? result.positive_factors : [],
    negativeFactors: Array.isArray(result.negative_factors) ? result.negative_factors : [],
    lens: result.lens,
    dailyScore: player.scores.pitchbrainFantaRating,
    bucket: tone === "favorable" ? "favorevole" : tone === "difficult" ? "sfavorevole" : "neutro",
    defenderLane: defenderLaneForPlayer(player),
    markingOpponentName: result.markingOpponentName,
    avgRating5: player.avgRating5,
    attackerName: player.roleGroup === "defender" ? threatName : player.playerName,
    attackerTeamName: player.roleGroup === "defender" ? translateTeamName(opponent) : player.teamName,
    defenderName: player.roleGroup === "defender" ? player.playerName : opponent,
    defenderTeamName: player.roleGroup === "defender" ? player.teamName : translateTeamName(opponent),
    attacker: {
      dribblesPer90: result.dribblesPer90,
      foulsDrawnPer90: result.foulsDrawnPer90,
      avgRating: player.avgRating5,
      shotsHint: shotsHint(player)
    },
    defender: {
      dribblesConcededHint: null,
      foulsCommittedPer90: null,
      yellowPer90: null,
      vulnerability: player.roleGroup === "forward" ? Math.round(100 - result.matchup_score) : result.matchup_score
    },
    reasons
  };
}

export function attachFantasyMatchups(
  players: FantaComputedPlayer[],
  markings: DifficultMarkingMatchup[],
  locale: Locale = "it"
): void {
  for (const player of players) {
    const evaluated = evaluateFantasyMatchup({ player, catalog: players, markings, locale });
    if (!evaluated) {
      player.matchup = null;
      continue;
    }
    player.scores = combineFantaRating({
      performance: player.scores.performance,
      production: player.scores.production,
      consistency: player.scores.consistency,
      matchup: evaluated.matchup_score
    });
    player.matchup = toFantasyMatchupCard({ player, catalog: players, result: evaluated, locale });
  }
}

export function listFantasyMatchupCards(
  players: FantaComputedPlayer[],
  locale: Locale = "it"
): FantaMatchupCard[] {
  return flattenMatchupBriefing(buildFantaMatchupBriefing(players, locale));
}
