"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import { KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, readAdminInsightsSnap, YELLOW_CARD_SNAPSHOT_UPDATED_EVENT } from "@/lib/kiosk-persisted-insights";
import {
  committedFoulSignalForRisk,
  foulsCommittedPerMatchForDisplay,
  foulsSufferedPerMatchForDisplay,
  sufferedFoulSignalForRisk
} from "@/lib/tactical-fouls-signals";
import type { UserAccessSummary } from "@/lib/auth/user-access";
import type { CompetitionScope, TacticalMetrics } from "@/lib/types";

type RiskLevel = "low" | "medium" | "high";

interface UpcomingMatchItem {
  eventId: number;
  competitionSlug: string;
  competitionName: string;
  startTimestamp: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
}

export interface YellowCardRiskPlayer {
  id: string;
  /** Partita Fonte (per garantire una sola riga per evento in Top 10). */
  eventId?: number;
  rank: number;
  playerName: string;
  playerInitials: string;
  role: string;
  teamName: string;
  teamCode: string;
  opponentName: string;
  opponentTeamName: string;
  opponentTeamCode: string;
  match: string;
  /** Per deduplica Top 10: stessa partita logica anche con eventId diversi in sorgente. */
  competitionSlug?: string;
  defenderFoulsCommittedAvg: number;
  opponentFoulsReceivedAvg: number;
  opponentSuccessfulDribblesAvg: number;
  recentYellowCards: number;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  matchupWeight?: number;
}

export const yellowCardRiskPlayers: YellowCardRiskPlayer[] = [
  {
    id: "mock-1",
    eventId: 900001,
    rank: 1,
    playerName: "Gianluca Mancini",
    playerInitials: "GM",
    role: "D",
    teamName: "AS Roma",
    teamCode: "ROM",
    opponentName: "Gabriel Strefezza",
    opponentTeamName: "Parma",
    opponentTeamCode: "PAR",
    match: "Parma vs AS Roma",
    defenderFoulsCommittedAvg: 2.18,
    opponentFoulsReceivedAvg: 2.08,
    opponentSuccessfulDribblesAvg: 1.56,
    recentYellowCards: 3,
    riskScore: 18.2,
    riskLevel: "high",
    reason:
      "Il rischio aumenta perché il difensore dovrà contenere un avversario che tende a subire molti falli e completare diversi dribbling. La combinazione tra falli commessi, pressione del matchup e storico disciplinare genera un indice elevato."
  },
  {
    id: "mock-2",
    eventId: 900002,
    rank: 2,
    playerName: "Marin Pongracic",
    playerInitials: "MP",
    role: "D",
    teamName: "Fiorentina",
    teamCode: "FIO",
    opponentName: "Vitinha",
    opponentTeamName: "Genoa",
    opponentTeamCode: "GEN",
    match: "Fiorentina vs Genoa",
    defenderFoulsCommittedAvg: 1.81,
    opponentFoulsReceivedAvg: 2.14,
    opponentSuccessfulDribblesAvg: 1.52,
    recentYellowCards: 2,
    riskScore: 17.2,
    riskLevel: "high",
    reason:
      "Profilo alto per incrocio tra aggressività difensiva, avversario che attira contatti e volume di dribbling."
  },
  {
    id: "mock-3",
    eventId: 900003,
    rank: 3,
    playerName: "Victor Nelsson",
    playerInitials: "VN",
    role: "D",
    teamName: "Hellas Verona",
    teamCode: "VER",
    opponentName: "Assane Diao",
    opponentTeamName: "Como",
    opponentTeamCode: "COM",
    match: "Hellas Verona vs Como",
    defenderFoulsCommittedAvg: 1.17,
    opponentFoulsReceivedAvg: 1.93,
    opponentSuccessfulDribblesAvg: 1.88,
    recentYellowCards: 2,
    riskScore: 15.6,
    riskLevel: "high",
    reason: "Avversario diretto molto mobile e propenso a ricevere contatti nel settore di competenza."
  },
  {
    id: "mock-4",
    eventId: 900004,
    rank: 4,
    playerName: "Giuseppe Pezzella",
    playerInitials: "GP",
    role: "D",
    teamName: "Cremonese",
    teamCode: "CRE",
    opponentName: "Isak Vural",
    opponentTeamName: "Pisa",
    opponentTeamCode: "PIS",
    match: "Cremonese vs Pisa",
    defenderFoulsCommittedAvg: 1.57,
    opponentFoulsReceivedAvg: 2.18,
    opponentSuccessfulDribblesAvg: 0.76,
    recentYellowCards: 2,
    riskScore: 14.9,
    riskLevel: "high",
    reason: "Matchup laterale con avversario che riceve diversi falli e può generare interventi in ritardo."
  },
  {
    id: "mock-5",
    eventId: 900005,
    rank: 5,
    playerName: "Abdoulaye Ndiaye",
    playerInitials: "AN",
    role: "D",
    teamName: "Parma",
    teamCode: "PAR",
    opponentName: "Wesley",
    opponentTeamName: "AS Roma",
    opponentTeamCode: "ROM",
    match: "Parma vs AS Roma",
    defenderFoulsCommittedAvg: 1.43,
    opponentFoulsReceivedAvg: 2,
    opponentSuccessfulDribblesAvg: 0.87,
    recentYellowCards: 1,
    riskScore: 14,
    riskLevel: "medium",
    reason: "Pressione di marcatura discreta su avversario che combina conduzione palla e contatti subiti."
  },
  {
    id: "mock-6",
    eventId: 900006,
    rank: 6,
    playerName: "Antonio Caracciolo",
    playerInitials: "AC",
    role: "D",
    teamName: "Pisa",
    teamCode: "PIS",
    opponentName: "Federico Bonazzoli",
    opponentTeamName: "Cremonese",
    opponentTeamCode: "CRE",
    match: "Cremonese vs Pisa",
    defenderFoulsCommittedAvg: 1.04,
    opponentFoulsReceivedAvg: 2.21,
    opponentSuccessfulDribblesAvg: 0.62,
    recentYellowCards: 1,
    riskScore: 13.1,
    riskLevel: "medium",
    reason: "Il dato falli subiti dell'avversario mantiene il profilo in fascia media."
  },
  {
    id: "mock-7",
    eventId: 900007,
    rank: 7,
    playerName: "Diego Carlos",
    playerInitials: "DC",
    role: "D",
    teamName: "Como",
    teamCode: "COM",
    opponentName: "Kieron Bowie",
    opponentTeamName: "Hellas Verona",
    opponentTeamCode: "VER",
    match: "Hellas Verona vs Como",
    defenderFoulsCommittedAvg: 1.48,
    opponentFoulsReceivedAvg: 1.55,
    opponentSuccessfulDribblesAvg: 0.49,
    recentYellowCards: 1,
    riskScore: 12.6,
    riskLevel: "medium",
    reason: "Rischio medio per volume falli del difensore e matchup centrale."
  },
  {
    id: "mock-8",
    eventId: 900008,
    rank: 8,
    playerName: "Johan Vasquez",
    playerInitials: "JV",
    role: "D",
    teamName: "Genoa",
    teamCode: "GEN",
    opponentName: "Dodo",
    opponentTeamName: "Fiorentina",
    opponentTeamCode: "FIO",
    match: "Fiorentina vs Genoa",
    defenderFoulsCommittedAvg: 0.6,
    opponentFoulsReceivedAvg: 1.46,
    opponentSuccessfulDribblesAvg: 1.41,
    recentYellowCards: 1,
    riskScore: 12,
    riskLevel: "medium",
    reason: "Avversario con buon volume di dribbling, ma falli del difensore non estremi."
  },
  {
    id: "mock-9",
    eventId: 900009,
    rank: 9,
    playerName: "Patrick Dorgu",
    playerInitials: "PD",
    role: "D",
    teamName: "Lecce",
    teamCode: "LEC",
    opponentName: "Napoli winger",
    opponentTeamName: "Napoli",
    opponentTeamCode: "NAP",
    match: "Lecce vs Napoli",
    defenderFoulsCommittedAvg: 1.2,
    opponentFoulsReceivedAvg: 1.38,
    opponentSuccessfulDribblesAvg: 1.12,
    recentYellowCards: 1,
    riskScore: 11.2,
    riskLevel: "medium",
    reason: "Fascia media per avversario dinamico, ma indice complessivo sotto la soglia alta."
  },
  {
    id: "mock-10",
    eventId: 900010,
    rank: 10,
    playerName: "Ismael Bennacer",
    playerInitials: "IB",
    role: "M",
    teamName: "AC Milan",
    teamCode: "MIL",
    opponentName: "Udinese midfielder",
    opponentTeamName: "Udinese",
    opponentTeamCode: "UDI",
    match: "AC Milan vs Udinese",
    defenderFoulsCommittedAvg: 1.1,
    opponentFoulsReceivedAvg: 1.29,
    opponentSuccessfulDribblesAvg: 1.05,
    recentYellowCards: 1,
    riskScore: 10.3,
    riskLevel: "medium",
    reason: "Rischio medio-basso, utile come confronto di scala."
  }
];

const TOP_LEAGUES = new Set(["serie-a", "premier-league", "laliga", "bundesliga", "ligue-1"]);
const REQUEST_TIMEOUT_MS = 12_000;
const BATCH_SIZE = 4;
const MIN_TARGET_FOULS = 1.4;
const MIN_TARGET_DRIBBLES = 0.45;
const METRICS_CACHE_PREFIX = "yellow-card-risk:metrics:v1:";
const SNAPSHOT_CACHE_KEY = "yellow-card-risk:snapshot:v2";
let yellowCardRiskLoadPromise: Promise<{
  matches: UpcomingMatchItem[];
  rows: YellowCardRiskPlayer[];
}> | null = null;

interface YellowCardRiskSnapshot {
  savedAt: string;
  matches: UpcomingMatchItem[];
  rows: YellowCardRiskPlayer[];
  insightsSnap?: number;
}

function normalizeCompetitionSlug(slug: string): string {
  const s = slug.toLowerCase().trim();
  return s === "la-liga" ? "laliga" : s;
}

function isTopLeague(slug: string): boolean {
  return TOP_LEAGUES.has(normalizeCompetitionSlug(slug));
}

function competitionLabel(slug: string): string {
  const labels: Record<string, string> = {
    "serie-a": "Serie A",
    "premier-league": "Premier League",
    laliga: "LaLiga",
    bundesliga: "Bundesliga",
    "ligue-1": "Ligue 1"
  };
  return labels[normalizeCompetitionSlug(slug)] ?? slug;
}

function scopeFromCompetitionSlug(slug: string): CompetitionScope {
  if (slug.includes("champions") || slug.includes("europa") || slug.includes("conference")) return "EUROPE";
  if (slug.includes("cup") || slug.includes("coppa") || slug.includes("copa") || slug.includes("pokal")) return "CUP";
  return "DOMESTIC";
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function initials(name: string): string {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
}

function teamCode(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter((word) => !["FC", "AC", "AS", "CF", "SC", "US"].includes(word.toUpperCase()));
  return (words[0] ?? clean).slice(0, 3).toUpperCase();
}

function normalizeName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function playerKey(player: TacticalMetrics): string {
  return `${player.teamId}|${normalizeName(player.playerName)}`;
}

function roleLabel(player: TacticalMetrics): string {
  if (player.roleIcon === "🛡️") return "D";
  if (player.roleIcon === "🎯") return "A";
  if (player.roleIcon === "🧤") return "P";
  return "M";
}

function targetFouls(player: TacticalMetrics): number {
  return foulsSufferedPerMatchForDisplay(player);
}

function dribbleSignal(player: TacticalMetrics): number {
  return numeric(player.dribblesSeasonAvg);
}

function hasRecentPlayingSample(m: TacticalMetrics): boolean {
  return (
    (m.foulsCommittedLastFiveSampleCount ?? 0) >= 1 ||
    (m.foulsSufferedLastFiveSampleCount ?? 0) >= 1
  );
}

type RoleBand = "gk" | "def" | "mid" | "att";
type Lane = -1 | 0 | 1;

function roleBand(player: TacticalMetrics): RoleBand {
  if (player.roleIcon === "🧤") return "gk";
  if (player.roleIcon === "🛡️") return "def";
  if (player.roleIcon === "🎯") return "att";
  return "mid";
}

function positionLane(positionCode?: string): Lane {
  const s = (positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s || s === "G" || s.startsWith("GK")) return 0;
  if (/^(DL|LWB|LB|ML|AML|LW|LM|WL)(\/|$)/.test(s)) return -1;
  if (/^(DR|RWB|RB|MR|AMR|RW|RM|WR)(\/|$)/.test(s)) return 1;
  const last = s[s.length - 1];
  const first = s[0];
  if (last === "L" && /^[DAMFW]/.test(first)) return -1;
  if (last === "R" && /^[DAMFW]/.test(first)) return 1;
  return 0;
}

function riskScore(target: TacticalMetrics, marker: TacticalMetrics, markingScore: number): number {
  return (
    committedFoulSignalForRisk(marker) * 2.9 +
    targetFouls(target) * 2.25 +
    dribbleSignal(target) * 2.05 +
    markingScore * 0.045 +
    numeric(marker.h2hYellowCards) * 0.45
  );
}

function riskLevel(score: number): RiskLevel {
  if (score >= 14) return "high";
  if (score >= 8) return "medium";
  return "low";
}

function formatDecimal(value: number): string {
  return value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKickoff(ts: number): string {
  if (!ts) return "Prossime partite";
  return new Date(ts * 1000).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Stessa soglia del kiosk: incrocio falli commessi vs subiti statisticamente plausibile. */
function isDirectionalFoulMatchup(likelyOffender: TacticalMetrics, likelyVictim: TacticalMetrics): boolean {
  const committed = committedFoulSignalForRisk(likelyOffender);
  const suffered = sufferedFoulSignalForRisk(likelyVictim);
  return (
    (committed >= 1.1 && suffered >= 1.25) ||
    (committed >= 1.35 && suffered >= 1.05)
  );
}

function pairKeyCanonical(a: TacticalMetrics, b: TacticalMetrics): string {
  const idA = typeof a.playerId === "number" && a.playerId > 0 ? a.playerId : 0;
  const idB = typeof b.playerId === "number" && b.playerId > 0 ? b.playerId : 0;
  if (idA > 0 && idB > 0) {
    return `id:${Math.min(idA, idB)}|${Math.max(idA, idB)}`;
  }
  return [normalizeName(a.playerName), normalizeName(b.playerName)].sort().join("|");
}

function sparkFrictionMarkingScore(marker: TacticalMetrics, target: TacticalMetrics): number {
  return Math.min(
    100,
    marker.sparkIndex +
      target.sparkIndex +
      (committedFoulSignalForRisk(marker) + sufferedFoulSignalForRisk(target)) * 8
  );
}

/**
 * Marcature come nel kiosk / scontri in campo: resolviamo il partner da `sparkDuel`
 * (heatmap + affinità di marcatura), non solo fasce posizionali.
 */
function buildRowsFromSparkDuels(match: UpcomingMatchItem, metrics: TacticalMetrics[]): YellowCardRiskPlayer[] {
  const homeId = match.homeTeam.id;
  const awayId = match.awayTeam.id;

  const byId = new Map<number, TacticalMetrics>();
  const byName = new Map<string, TacticalMetrics[]>();
  for (const row of metrics) {
    if (typeof row.playerId === "number" && row.playerId > 0) {
      byId.set(row.playerId, row);
    }
    const key = row.playerName.toUpperCase();
    const bucket = byName.get(key);
    if (bucket) bucket.push(row);
    else byName.set(key, [row]);
  }

  const rows: YellowCardRiskPlayer[] = [];
  const seenPairs = new Set<string>();
  const reasonSpark =
    "Coppia basata sul duello tattico previsto dal modello (marcatura plausibile e sovrapposizione zona campo), con medie falli e dribbling come nella vista scontri.";

  for (const item of metrics) {
    if (!item.sparkDuel) continue;
    const duelBId = item.sparkDuel.playerBId;
    const candidateById =
      typeof duelBId === "number" && duelBId > 0 ? byId.get(duelBId) ?? null : null;
    const candidatesByName = byName.get(item.sparkDuel.playerB.toUpperCase()) ?? [];
    const candidate =
      candidateById && candidateById.teamId !== item.teamId
        ? candidateById
        : candidatesByName.find((r) => r.teamId !== item.teamId) ?? null;
    if (!candidate) continue;
    if (candidate.teamId === item.teamId) continue;

    const teams = new Set([item.teamId, candidate.teamId]);
    if (!teams.has(homeId) || !teams.has(awayId)) continue;

    const directInteresting = isDirectionalFoulMatchup(item, candidate);
    const reverseInteresting = isDirectionalFoulMatchup(candidate, item);
    if (!directInteresting && !reverseInteresting) continue;

    const itemDef = roleBand(item) === "def";
    const candDef = roleBand(candidate) === "def";
    const itemFwd = roleBand(item) === "att" || roleBand(item) === "mid";
    const candFwd = roleBand(candidate) === "att" || roleBand(candidate) === "mid";

    let marker: TacticalMetrics;
    let target: TacticalMetrics;

    if (itemDef && candFwd) {
      marker = item;
      target = candidate;
    } else if (candDef && itemFwd) {
      marker = candidate;
      target = item;
    } else {
      const directScore =
        committedFoulSignalForRisk(item) * 1.15 +
        sufferedFoulSignalForRisk(candidate) +
        item.sparkIndex * 0.08 +
        candidate.sparkIndex * 0.04;
      const reverseScore =
        committedFoulSignalForRisk(candidate) * 1.15 +
        sufferedFoulSignalForRisk(item) +
        candidate.sparkIndex * 0.08 +
        item.sparkIndex * 0.04;
      const useDirect =
        directInteresting && reverseInteresting ? directScore >= reverseScore : directInteresting;
      const left = useDirect ? item : candidate;
      const right = useDirect ? candidate : item;
      if (roleBand(left) === "def" && right.roleIcon !== "🧤") {
        marker = left;
        target = right;
      } else if (roleBand(right) === "def" && left.roleIcon !== "🧤") {
        marker = right;
        target = left;
      } else {
        continue;
      }
    }

    if (marker.roleIcon === "🧤" || target.roleIcon === "🧤") continue;

    const pk = pairKeyCanonical(marker, target);
    if (seenPairs.has(pk)) continue;
    seenPairs.add(pk);

    const fouls = targetFouls(target);
    const dribbles = dribbleSignal(target);
    if (fouls < MIN_TARGET_FOULS || dribbles < MIN_TARGET_DRIBBLES) continue;
    if (!hasRecentPlayingSample(target) || !hasRecentPlayingSample(marker)) continue;

    const markingScore = sparkFrictionMarkingScore(marker, target);
    const score = riskScore(target, marker, markingScore);
    if (score < 8) continue;

    rows.push({
      id: `${match.eventId}-${playerKey(marker)}-${playerKey(target)}`,
      eventId: match.eventId,
      rank: 0,
      playerName: marker.playerName,
      playerInitials: initials(marker.playerName),
      role: roleLabel(marker),
      teamName: marker.team,
      teamCode: teamCode(marker.team),
      opponentName: target.playerName,
      opponentTeamName: target.team,
      opponentTeamCode: teamCode(target.team),
      match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      competitionSlug: match.competitionSlug,
      defenderFoulsCommittedAvg: foulsCommittedPerMatchForDisplay(marker),
      opponentFoulsReceivedAvg: fouls,
      opponentSuccessfulDribblesAvg: dribbles,
      recentYellowCards: Math.round(numeric(marker.h2hYellowCards)),
      riskScore: Math.round(score * 10) / 10,
      riskLevel: riskLevel(score),
      matchupWeight: Math.round(markingScore),
      reason: reasonSpark
    });
  }
  return rows;
}

/** Fallback se `match-insights` non espone `sparkDuel` per nessun giocatore (es. heatmap insufficienti). */
function findMarkerHeuristic(target: TacticalMetrics, metrics: TacticalMetrics[]): {
  marker: TacticalMetrics;
  markingScore: number;
} | null {
  const targetLane = positionLane(target.positionCode);
  const candidates = metrics
    .filter((opponent) => opponent.teamId !== target.teamId)
    .filter((opponent) => roleBand(opponent) === "def")
    .map((opponent) => {
      const markerLane = positionLane(opponent.positionCode);
      const mirroredWide = targetLane !== 0 && markerLane !== 0 && targetLane === -markerLane;
      const sameProviderWide = targetLane !== 0 && markerLane !== 0 && targetLane === markerLane;
      const bothCentral = targetLane === 0 && markerLane === 0;
      const oneWideOneUnknown = (targetLane !== 0 && markerLane === 0) || (targetLane === 0 && markerLane !== 0);
      const roleScore = 28;
      const laneScore = mirroredWide ? 64 : sameProviderWide ? 44 : bothCentral ? 34 : oneWideOneUnknown ? 18 : 0;
      const aggressionScore = Math.min(28, committedFoulSignalForRisk(opponent) * 12);
      return { marker: opponent, markingScore: Math.min(100, laneScore + roleScore + aggressionScore) };
    })
    .filter((candidate) => candidate.markingScore >= 48)
    .sort((a, b) => b.markingScore - a.markingScore);
  return candidates[0] ?? null;
}

function buildRowsFromHeuristicFallback(match: UpcomingMatchItem, metrics: TacticalMetrics[]): YellowCardRiskPlayer[] {
  const rows: YellowCardRiskPlayer[] = [];
  const reasonHeuristic =
    "Stima di marcatura per fascia posizionale: i dati duello completi non erano disponibili per questo match.";
  for (const target of metrics) {
    if (target.roleIcon === "🧤") continue;
    const fouls = targetFouls(target);
    const dribbles = dribbleSignal(target);
    if (fouls < MIN_TARGET_FOULS || dribbles < MIN_TARGET_DRIBBLES) continue;
    const markerHit = findMarkerHeuristic(target, metrics);
    if (!markerHit) continue;
    if (!hasRecentPlayingSample(target) || !hasRecentPlayingSample(markerHit.marker)) continue;
    const score = riskScore(target, markerHit.marker, markerHit.markingScore);
    if (score < 8) continue;
    rows.push({
      id: `${match.eventId}-${playerKey(markerHit.marker)}-${playerKey(target)}`,
      eventId: match.eventId,
      rank: 0,
      playerName: markerHit.marker.playerName,
      playerInitials: initials(markerHit.marker.playerName),
      role: roleLabel(markerHit.marker),
      teamName: markerHit.marker.team,
      teamCode: teamCode(markerHit.marker.team),
      opponentName: target.playerName,
      opponentTeamName: target.team,
      opponentTeamCode: teamCode(target.team),
      match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      competitionSlug: match.competitionSlug,
      defenderFoulsCommittedAvg: foulsCommittedPerMatchForDisplay(markerHit.marker),
      opponentFoulsReceivedAvg: fouls,
      opponentSuccessfulDribblesAvg: dribbles,
      recentYellowCards: Math.round(numeric(markerHit.marker.h2hYellowCards)),
      riskScore: Math.round(score * 10) / 10,
      riskLevel: riskLevel(score),
      matchupWeight: Math.round(markerHit.markingScore),
      reason: reasonHeuristic
    });
  }
  return rows;
}

function buildRowsFromMatch(match: UpcomingMatchItem, metrics: TacticalMetrics[]): YellowCardRiskPlayer[] {
  const fromSpark = buildRowsFromSparkDuels(match, metrics);
  if (fromSpark.length > 0) return fromSpark;
  return buildRowsFromHeuristicFallback(match, metrics);
}

/** Etichetta partita stabile: nomi squadra ordinati così casa/trasferta non crea duplicati. */
function normalizeMatchLabel(matchLabel: string): string {
  const t = matchLabel
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const parts = t.split(/\s+vs\s+/i).map((s) => s.trim());
  if (parts.length === 2) {
    const [a, b] = [parts[0], parts[1]].sort((x, y) => x.localeCompare(y));
    return `${a} vs ${b}`;
  }
  return t;
}

/**
 * Una sola riga per partita logica: stesso match può arrivare più volte con `eventId` diversi dal feed.
 * Usiamo competizione + etichetta normalizzata, non solo eventId.
 */
function matchClusterKey(row: YellowCardRiskPlayer): string {
  const fixture = normalizeMatchLabel(row.match);
  const slug = row.competitionSlug?.trim() ? normalizeCompetitionSlug(row.competitionSlug) : "";
  return slug ? `${slug}::${fixture}` : fixture;
}

/** Top 10 con partite tutte diverse: per ogni partita solo il duello a rischio più alto. */
function pickTopTenUniqueMatches(rows: YellowCardRiskPlayer[]): YellowCardRiskPlayer[] {
  const sorted = [...rows].sort((a, b) => b.riskScore - a.riskScore);
  const seen = new Set<string>();
  const out: YellowCardRiskPlayer[] = [];
  for (const row of sorted) {
    const key = matchClusterKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= 10) break;
  }
  return out.map((row, index) => ({ ...row, rank: index + 1 }));
}

function dedupeMatchesByEventId(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  const map = new Map<number, UpcomingMatchItem>();
  for (const match of matches) {
    if (!map.has(match.eventId)) {
      map.set(match.eventId, match);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}
/** Tutte le partite future nei cinque campionati indicati (nessun limite artificiale). */
function allTopFiveLeagueUpcomingMatches(raw: UpcomingMatchItem[]): UpcomingMatchItem[] {
  return filterMatchesKickoffInFuture(dedupeMatchesByEventId(raw))
    .filter((row) => isTopLeague(row.competitionSlug))
    .sort((a, b) => a.startTimestamp - b.startTimestamp);
}

function isLiveLike(match?: UpcomingMatchItem): boolean {
  if (!match?.startTimestamp) return false;
  const now = Date.now() / 1000;
  return now >= match.startTimestamp && now <= match.startTimestamp + 2 * 60 * 60;
}

function cachedMetricsKey(eventId: number): string {
  return `${METRICS_CACHE_PREFIX}${eventId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function compactMetric(player: TacticalMetrics): Partial<TacticalMetrics> {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    positionCode: player.positionCode,
    roleIcon: player.roleIcon,
    team: player.team,
    teamId: player.teamId,
    foulsCommittedSeasonAvg: player.foulsCommittedSeasonAvg,
    foulsCommittedLastFiveAvg: player.foulsCommittedLastFiveAvg,
    foulsSufferedSeasonAvg: player.foulsSufferedSeasonAvg,
    dribblesSeasonAvg: player.dribblesSeasonAvg,
    h2hFoulsCommitted: player.h2hFoulsCommitted,
    h2hYellowCards: player.h2hYellowCards
  };
}

function readCachedMetrics(eventId: number): TacticalMetrics[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(cachedMetricsKey(eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { metrics?: Array<Partial<TacticalMetrics>> };
    return Array.isArray(parsed.metrics) ? (parsed.metrics as TacticalMetrics[]) : [];
  } catch {
    return [];
  }
}

function writeCachedMetrics(match: UpcomingMatchItem, metrics: TacticalMetrics[]): void {
  if (!canUseStorage() || metrics.length === 0) return;
  try {
    window.localStorage.setItem(
      cachedMetricsKey(match.eventId),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        match,
        metrics: metrics.map(compactMetric)
      })
    );
  } catch {
    // Cache best-effort: se localStorage è pieno, il live resta comunque prioritario.
  }
}

function readCachedSnapshot(): YellowCardRiskSnapshot | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as YellowCardRiskSnapshot;
    return Array.isArray(parsed.rows) && Array.isArray(parsed.matches) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: Omit<YellowCardRiskSnapshot, "savedAt">): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      SNAPSHOT_CACHE_KEY,
      JSON.stringify({
        ...snapshot,
        savedAt: new Date().toISOString()
      })
    );
    window.dispatchEvent(new CustomEvent(YELLOW_CARD_SNAPSHOT_UPDATED_EVENT));
  } catch {
    // Non bloccare la pagina se il browser rifiuta la cache.
  }
}

async function fetchMetrics(
  match: UpcomingMatchItem,
  parentSignal: AbortSignal,
  forceRefresh = false
): Promise<TacticalMetrics[]> {
  const ac = new AbortController();
  const timeoutId = window.setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  const abortFromParent = () => ac.abort();
  parentSignal.addEventListener("abort", abortFromParent, { once: true });
  try {
    const scope = scopeFromCompetitionSlug(match.competitionSlug);
    const forceParam = forceRefresh ? "&forceRefresh=1" : "";
    const res = await fetch(
      `/api/tactical/match-insights?eventId=${match.eventId}&homeTeamId=${match.homeTeam.id}&awayTeamId=${match.awayTeam.id}&homeTeamName=${encodeURIComponent(
        match.homeTeam.name
      )}&awayTeamName=${encodeURIComponent(
        match.awayTeam.name
      )}&competitionSlug=${encodeURIComponent(match.competitionSlug)}&scope=${scope}${forceParam}`,
      { cache: "no-store", signal: ac.signal }
    );
    if (!res.ok) return readCachedMetrics(match.eventId);
    const json = (await res.json()) as { metrics?: TacticalMetrics[] };
    const metrics = Array.isArray(json.metrics) ? json.metrics : [];
    writeCachedMetrics(match, metrics);
    return metrics.length > 0 ? metrics : readCachedMetrics(match.eventId);
  } catch {
    return readCachedMetrics(match.eventId);
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal.removeEventListener("abort", abortFromParent);
  }
}

async function loadYellowCardRiskData(options?: {
  forceRefresh?: boolean;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  matches: UpcomingMatchItem[];
  rows: YellowCardRiskPlayer[];
}> {
  const forceRefresh = options?.forceRefresh ?? false;
  const onProgress = options?.onProgress;

  /* Nessuna rete: snapshot locale già calcolato (l'aggiornamento parte solo da pulsante admin o refresh globale kiosk). */
  if (!forceRefresh) {
    const cachedOnly = readCachedSnapshot();
    if (cachedOnly?.rows?.length) {
      const n = cachedOnly.matches?.length ?? 0;
      onProgress?.(n, Math.max(n, 1));
      yellowCardRiskLoadPromise = Promise.resolve({
        matches: cachedOnly.matches ?? [],
        rows: cachedOnly.rows
      });
      return yellowCardRiskLoadPromise;
    }
  }

  if (yellowCardRiskLoadPromise && !forceRefresh && !onProgress) {
    return yellowCardRiskLoadPromise;
  }

  const run = async (): Promise<{ matches: UpcomingMatchItem[]; rows: YellowCardRiskPlayer[] }> => {
    const ac = new AbortController();
    const cachedSnapshot = readCachedSnapshot();
    let topMatches: UpcomingMatchItem[] = [];

    try {
      const matchRes = await fetch("/api/tactical/matches", { cache: "no-store", signal: ac.signal });
      if (!matchRes.ok) throw new Error("matches_unavailable");
      const matchJson = (await matchRes.json()) as { matches?: UpcomingMatchItem[] };
      topMatches = allTopFiveLeagueUpcomingMatches(matchJson.matches ?? []);
    } catch {
      topMatches = allTopFiveLeagueUpcomingMatches(cachedSnapshot?.matches ?? []);
    }

    if (topMatches.length === 0 && cachedSnapshot) {
      onProgress?.(0, 0);
      return { matches: cachedSnapshot.matches, rows: cachedSnapshot.rows };
    }

    const total = topMatches.length;
    onProgress?.(0, total);

    const collected: YellowCardRiskPlayer[] = [];
    for (let i = 0; i < topMatches.length; i += BATCH_SIZE) {
      const batch = topMatches.slice(i, i + BATCH_SIZE);
      const loaded = await Promise.all(
        batch.map(async (match) => ({
          match,
          metrics: await fetchMetrics(match, ac.signal, forceRefresh)
        }))
      );
      for (const item of loaded) {
        collected.push(...buildRowsFromMatch(item.match, item.metrics));
      }
      onProgress?.(Math.min(i + batch.length, topMatches.length), topMatches.length);
    }

    const ranked = pickTopTenUniqueMatches(collected);

    if (ranked.length > 0) {
      writeCachedSnapshot({ matches: topMatches, rows: ranked, insightsSnap: readAdminInsightsSnap() });
      return { matches: topMatches, rows: ranked };
    }

    if (cachedSnapshot) {
      return {
        matches: topMatches.length > 0 ? topMatches : cachedSnapshot.matches,
        rows: cachedSnapshot.rows
      };
    }

    return { matches: topMatches, rows: ranked };
  };

  if (!onProgress) {
    yellowCardRiskLoadPromise = run();
    try {
      return await yellowCardRiskLoadPromise;
    } catch (error) {
      yellowCardRiskLoadPromise = null;
      throw error;
    }
  }

  const result = await run();
  yellowCardRiskLoadPromise = Promise.resolve(result);
  return result;
}

function GenericAvatar({ initials: value }: { initials: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-600/60 bg-slate-700/70 text-xs font-black text-slate-200 shadow-inner">
      {value}
    </span>
  );
}

function TeamCodeBadge({ code, tone = "blue" }: { code: string; tone?: "blue" | "red" | "gold" | "slate" }) {
  const classes = {
    blue: "border-sky-400/20 bg-sky-500/14 text-sky-200",
    red: "border-red-400/20 bg-red-500/14 text-red-200",
    gold: "border-yellow-300/20 bg-yellow-300/14 text-yellow-100",
    slate: "border-slate-400/20 bg-slate-500/14 text-slate-200"
  };
  return (
    <span className={`inline-flex min-w-11 justify-center rounded-lg border px-2 py-1 text-[11px] font-black ${classes[tone]}`}>
      {code}
    </span>
  );
}

function RiskScoreBar({ score }: { score: number }) {
  const width = Math.max(6, Math.min(100, (score / 20) * 100));
  return (
    <div className="min-w-[96px]">
      <p className="text-sm font-black text-yellow-300">{score.toFixed(1)}</p>
      <div className="mt-1 h-1.5 rounded-full bg-slate-700/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 shadow-[0_0_12px_rgba(250,204,21,0.45)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function DetailPanel({ row }: { row: YellowCardRiskPlayer }) {
  return (
    <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.045] p-4 text-sm text-slate-300">
      <p className="font-bold text-slate-100">Perché è in top 10?</p>
      <p className="mt-2 leading-relaxed">{row.reason}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <MetricPill label="Falli difensore" value={formatDecimal(row.defenderFoulsCommittedAvg)} />
        <MetricPill label="Falli subiti avversario" value={formatDecimal(row.opponentFoulsReceivedAvg)} />
        <MetricPill label="Dribbling avversario" value={formatDecimal(row.opponentSuccessfulDribblesAvg)} />
        <MetricPill label="Cartellini recenti" value={String(row.recentYellowCards)} />
        <MetricPill label="Peso matchup" value={`${row.matchupWeight ?? 0}/100`} />
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-[#07111F] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}

function RiskRow({ row }: { row: YellowCardRiskPlayer }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-slate-800/80 transition hover:bg-sky-400/[0.035]">
        <td className="px-4 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-yellow-400/85 text-xs font-black text-slate-950">
            {row.rank}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <GenericAvatar initials={row.playerInitials} />
            <div>
              <p className="font-black text-slate-100">{row.playerName}</p>
              <p className="text-xs font-semibold text-slate-500">{row.role}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><TeamCodeBadge code={row.teamCode} tone="red" /></td>
        <td className="px-4 py-3">
          <p className="font-bold text-slate-200">{row.opponentName}</p>
          <p className="mt-1"><TeamCodeBadge code={row.opponentTeamCode} /></p>
        </td>
        <td className="px-4 py-3 text-slate-300">{row.match}</td>
        <td className="px-4 py-3 text-center text-base text-slate-100">{formatDecimal(row.defenderFoulsCommittedAvg)}</td>
        <td className="px-4 py-3 text-center text-base text-slate-100">{formatDecimal(row.opponentFoulsReceivedAvg)}</td>
        <td className="px-4 py-3 text-center text-base text-slate-100">{formatDecimal(row.opponentSuccessfulDribblesAvg)}</td>
        <td className="px-4 py-3 text-center text-base text-slate-100">{row.recentYellowCards}</td>
        <td className="px-4 py-3"><RiskScoreBar score={row.riskScore} /></td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200 hover:border-sky-300 hover:bg-sky-400/20"
          >
            Dettagli {open ? "⌃" : "⌄"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-slate-800/80">
          <td colSpan={11} className="px-4 py-4">
            <DetailPanel row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RiskMobileCard({ row }: { row: YellowCardRiskPlayer }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl border border-slate-800 bg-[#07111F]/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-yellow-400/85 text-xs font-black text-slate-950">
            {row.rank}
          </span>
          <GenericAvatar initials={row.playerInitials} />
          <div>
            <p className="font-black text-slate-100">{row.playerName}</p>
            <p className="text-xs text-slate-500">{row.teamName} vs {row.opponentTeamName}</p>
          </div>
        </div>
        <RiskScoreBar score={row.riskScore} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <MetricPill label="Falli def" value={formatDecimal(row.defenderFoulsCommittedAvg)} />
        <MetricPill label="Falli avv." value={formatDecimal(row.opponentFoulsReceivedAvg)} />
        <MetricPill label="Dribbling" value={formatDecimal(row.opponentSuccessfulDribblesAvg)} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 w-full rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200"
      >
        Dettagli {open ? "⌃" : "⌄"}
      </button>
      {open ? <div className="mt-3"><DetailPanel row={row} /></div> : null}
    </li>
  );
}

function LockedRiskRow({ rank }: { rank: number }) {
  return (
    <tr className="border-t border-slate-800/80 bg-slate-950/35">
      <td className="px-4 py-4">
        <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-black text-slate-300">#{rank}</span>
      </td>
      <td colSpan={10} className="px-4 py-4">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 px-4 py-4 text-sm text-slate-400 blur-[1px]">
          Profilo riservato agli utenti Pro.
        </div>
      </td>
    </tr>
  );
}

function LockedRiskMobileCard({ rank }: { rank: number }) {
  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-500">
      <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-black text-slate-300">#{rank}</span>
      <p className="mt-4 blur-[1px]">Profilo riservato agli utenti Pro.</p>
    </li>
  );
}

function RiskTable({ rows, visibleRankSet }: { rows: YellowCardRiskPlayer[]; visibleRankSet?: Set<number> }) {
  return (
    <div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 bg-[#07111F]/80 lg:block">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900/75 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Giocatore da marcare</th>
              <th className="px-4 py-3">Squadra</th>
              <th className="px-4 py-3">Avversario diretto</th>
              <th className="px-4 py-3">Match</th>
              <th className="px-4 py-3 text-center">Falli commessi difensore</th>
              <th className="px-4 py-3 text-center">Falli subiti avversario</th>
              <th className="px-4 py-3 text-center">Dribbling riusciti avversario</th>
              <th className="px-4 py-3 text-center">Ammonizioni recenti</th>
              <th className="px-4 py-3">Indice rischio</th>
              <th className="px-4 py-3">Dettaglio analitico</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) =>
              !visibleRankSet || visibleRankSet.has(index) ? (
                <RiskRow key={row.id} row={row} />
              ) : (
                <LockedRiskRow key={`locked-${row.id}`} rank={index + 1} />
              )
            )}
          </tbody>
        </table>
      </div>
      <ol className="space-y-3 lg:hidden">
        {rows.map((row, index) =>
          !visibleRankSet || visibleRankSet.has(index) ? (
            <RiskMobileCard key={row.id} row={row} />
          ) : (
            <LockedRiskMobileCard key={`locked-${row.id}`} rank={index + 1} />
          )
        )}
      </ol>
    </div>
  );
}

function DataMeaningCards() {
  return (
    <div className="grid gap-4 border-t border-slate-800 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
      <InfoBox
        title="Falli subiti avversario"
        description="Media dei falli subiti nelle ultime partite dall'avversario diretto che questo giocatore dovrà marcare."
      />
      <InfoBox
        title="Dribbling riusciti avversario"
        description="Media dei dribbling riusciti dall'avversario diretto. Più dribbling riusciti possono aumentare la probabilità di interventi fallosi."
      />
      <InfoBox
        title="Indice rischio ammonizione"
        description="Score proprietario che combina falli commessi, falli subiti dall'avversario, dribbling, ruolo, contesto partita e storico ammonizioni."
      />
      <RiskLegend />
    </div>
  );
}

function InfoBox({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/75 p-4">
      <p className="font-black text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function RiskLegend() {
  return (
    <div className="min-w-[180px] rounded-2xl border border-slate-800 bg-[#07111F]/75 p-4 text-sm">
      <p className="mb-3 font-black text-slate-100">Legenda</p>
      <p className="flex justify-between gap-4 text-slate-400"><span>Rischio basso</span><span>0 - 8</span></p>
      <p className="flex justify-between gap-4 text-yellow-200"><span>Rischio medio</span><span>8 - 14</span></p>
      <p className="flex justify-between gap-4 text-red-300"><span>Rischio alto</span><span>14+</span></p>
    </div>
  );
}

function WarningIcon() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-300/40 bg-yellow-300/10 text-yellow-300">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 2.7 20h18.6L12 3Z" />
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
      </svg>
    </span>
  );
}

export function YellowCardRiskPage({ userAccess }: { userAccess: UserAccessSummary }) {
  const [rows, setRows] = useState<YellowCardRiskPlayer[]>([]);
  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const snap = readCachedSnapshot();
    if (snap?.rows?.length) {
      setRows(snap.rows);
      setMatches(snap.matches ?? []);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const snap = readCachedSnapshot();
      if (snap?.rows?.length && mountedRef.current) {
        setRows(snap.rows);
        setMatches(snap.matches ?? []);
        setLoading(false);
      }
    };
    window.addEventListener(YELLOW_CARD_SNAPSHOT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(YELLOW_CARD_SNAPSHOT_UPDATED_EVENT, handler);
  }, []);

  const refreshAllData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setLoadProgress({ current: 0, total: 0 });
    if (forceRefresh) yellowCardRiskLoadPromise = null;
    try {
      const data = await loadYellowCardRiskData({
        forceRefresh,
        onProgress: (current, total) => {
          if (mountedRef.current) setLoadProgress({ current, total });
        }
      });
      if (mountedRef.current) {
        setMatches(data.matches);
        setRows(data.rows);
      }
    } catch {
      if (mountedRef.current) {
        setError("Dati live non disponibili in questo momento.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadProgress(null);
      }
    }
  }, []);

  useEffect(() => {
    const onAdminInsights = () => {
      void refreshAllData(true);
    };
    window.addEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onAdminInsights);
    return () => window.removeEventListener(KIOSK_ADMIN_INSIGHTS_REFRESH_EVENT, onAdminInsights);
  }, [refreshAllData]);

  const headerMatch = matches[0];
  const headerLabel = useMemo(() => {
    if (!headerMatch) return "Top 5 campionati";
    return `${competitionLabel(headerMatch.competitionSlug)} - Prossima giornata`;
  }, [headerMatch]);
  /** Con dati reali: deduplica anche in UI (cache vecchie / stesso match con più eventId). Preview mock: elenco fisso 10. */
  const visibleRows = useMemo(() => {
    if (rows.length === 0) return yellowCardRiskPlayers;
    return pickTopTenUniqueMatches(rows);
  }, [rows]);
  const isPreview = rows.length === 0;
  const visibleRankSet = useMemo(() => {
    if (!userAccess.isMember) return undefined;
    const indexes = Array.from({ length: Math.min(visibleRows.length, 10) }, (_, index) => index);
    for (let i = indexes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return new Set(indexes.slice(0, userAccess.yellowCardVisibleRows ?? 3));
  }, [userAccess.isMember, userAccess.yellowCardVisibleRows, visibleRows.length]);

  return (
    <main className="min-h-screen bg-[#050B14] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px] rounded-[1.75rem] border border-[#1E3248] bg-gradient-to-br from-[#07111F] via-[#06101C] to-[#050B14] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-400">Match Dashboard</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Kiosk Tactical Menu</h1>
            <nav className="mt-5 flex flex-wrap gap-3">
              {[
                ["Scontri in campo", "/kiosk"],
                ["Rischio falli subiti", "/kiosk"],
                ["Rischio falli commessi", "/kiosk"]
              ].map(([label, href], index) => (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-xl border px-5 py-3 text-sm font-bold transition ${
                    index === 0
                      ? "border-sky-400 bg-sky-500 text-white shadow-[0_0_24px_rgba(14,165,233,0.25)]"
                      : "border-slate-800 bg-[#07111F] text-slate-300 hover:border-sky-500 hover:text-sky-200"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-4 text-sm text-slate-300">
            <p className="font-bold text-white">{headerLabel}</p>
            <p className="mt-2 flex items-center gap-2">
              <span aria-hidden>▣</span>
              <span>{formatKickoff(headerMatch?.startTimestamp ?? 0)}</span>
              {isLiveLike(headerMatch) ? <span className="ml-4 text-emerald-400">● Live</span> : null}
            </p>
          </div>
        </header>

        <article className="mt-5 overflow-hidden rounded-[1.35rem] border border-[#1E3248] bg-[#050B14]/55">
          <div className="flex flex-col gap-4 border-b border-slate-800 bg-gradient-to-r from-yellow-300/[0.06] via-transparent to-sky-500/[0.04] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <WarningIcon />
              <div>
                <h2 className="text-2xl font-black tracking-tight text-yellow-300">ALLARME AMMONIZIONI</h2>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">
                  Top 10 dei migliori scontri a rischio ammonizione, con una sola riga per partita (il duello
                  marcatore–avversario più critico): calcolo su tutte le partite future dei top 5 campionati europei.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-yellow-200">
              <span aria-hidden>🏆</span> Solo top 5 campionati
            </span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {userAccess.canRefreshData
                  ? "Accesso admin: puoi ricalcolare la Top 10 quando aggiorni i dati."
                  : userAccess.isMember
                    ? "Account membro: sono visibili 3 posizioni casuali della Top 10, le altre restano oscurate."
                    : "Account Pro: puoi consultare tutta la Top 10 disponibile."}
              </p>
              {userAccess.canRefreshData ? (
                <button
                  type="button"
                  onClick={() => void refreshAllData(true)}
                  disabled={loading}
                  className="rounded-full border border-sky-300/45 bg-sky-500 px-5 py-2 text-sm font-black text-white shadow-[0_12px_30px_rgba(14,165,233,0.18)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Aggiornamento..." : "Aggiorna Allarme Ammonizioni"}
                </button>
              ) : null}
            </div>
            {isPreview ? (
              <div className="mb-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-100">
                {loading
                  ? "Anteprima grafica con dati dimostrativi: sto caricando la Top 10 reale dai prossimi match."
                  : error
                    ? `${error} Mostro una preview grafica dimostrativa della schermata.`
                    : "Nessun profilo reale sopra soglia trovato ora: mostro una preview grafica dimostrativa della schermata."}
              </div>
            ) : null}
            <RiskTable rows={visibleRows} visibleRankSet={visibleRankSet} />
          </div>

          {loading && loadProgress ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050814]/92 p-6 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-yellow-300/20 bg-[#07111F] p-6 shadow-2xl">
                <p className="text-center text-sm font-bold uppercase tracking-wide text-yellow-200">
                  Top 10 in elaborazione
                </p>
                <p className="mt-2 text-center text-sm text-slate-300">
                  {loadProgress.total > 0 ? (
                    <>
                      Partite analizzate:{" "}
                      <strong className="text-white">{loadProgress.current}</strong> di{" "}
                      <strong className="text-white">{loadProgress.total}</strong>
                    </>
                  ) : (
                    <span>Recupero elenco partite dai top 5 campionati…</span>
                  )}
                </p>
                <p className="mt-1 text-center text-xs text-slate-500">
                  {loadProgress.total === 0
                    ? "Attendi: sto preparando tutte le partite da analizzare."
                    : loadProgress.total > 0 && loadProgress.total - loadProgress.current > 0
                      ? `Mancano ancora ${loadProgress.total - loadProgress.current} partit${
                          loadProgress.total - loadProgress.current === 1 ? "a" : "e"
                        } da analizzare.`
                      : "Finalizzazione classifica…"}
                </p>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-300 ${
                      loadProgress.total === 0 ? "animate-pulse" : ""
                    }`}
                    style={{
                      width:
                        loadProgress.total > 0
                          ? `${Math.min(100, (loadProgress.current / loadProgress.total) * 100)}%`
                          : "35%"
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DataMeaningCards />
        </article>

        <footer className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <p>Tactical Intelligence Hub: piattaforma di analisi sportiva, statistica ed editoriale.</p>
        </footer>
      </section>
    </main>
  );
}
