import type { TacticalMetrics } from "@/lib/types";
import {
  committedFoulSignalForRisk as committedSignal,
  sufferedFoulSignalForRisk as sufferedSignal
} from "@/lib/tactical-fouls-signals";

export type FoulRiskAnalysisKind = "suffered" | "committed";

export interface FoulRiskAggressorBrief {
  playerName: string;
  team: string;
  positionCode?: string;
  markingScore: number;
  riskContribution: number;
  foulsCommittedSeasonAvg: number;
  foulsSufferedSeasonAvg: number;
}

export interface FoulRiskEntry {
  playerId?: number;
  playerName: string;
  team: string;
  teamId: number;
  clubColor: string;
  kind: FoulRiskAnalysisKind;
  riskScore: number;
  starRating: number;
  markerPositionCode?: string;
  matchupScore: number;
  aggressors: FoulRiskAggressorBrief[];
  justification: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

type RoleBand = "gk" | "def" | "mid" | "att";
type Lane = -1 | 0 | 1;

function roleBand(m: TacticalMetrics): RoleBand {
  if (m.roleIcon === "🧤") return "gk";
  if (m.roleIcon === "🛡️") return "def";
  if (m.roleIcon === "🎯") return "att";
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

function positionLabel(positionCode?: string): string {
  return positionCode?.trim() ? positionCode.trim().toUpperCase() : "zona centrale";
}

/**
 * 0-100: probabilità di marcatura/incrocio in base alla posizione prevista, non alla heatmap.
 * La logica considera i codici in prospettiva della propria squadra: un terzino destro (+1)
 * incrocia spesso l'ala sinistra avversaria (-1), come da richiesta.
 */
function markingMatchScore(target: TacticalMetrics, opponent: TacticalMetrics): number {
  const aRole = roleBand(target);
  const bRole = roleBand(opponent);
  if (aRole === "gk" || bRole === "gk") return 0;

  const aLane = positionLane(target.positionCode);
  const bLane = positionLane(opponent.positionCode);
  const oppositeWide = aLane !== 0 && bLane !== 0 && aLane === -bLane;
  const bothCentral = aLane === 0 && bLane === 0;
  const oneWideOneUnknown = (aLane !== 0 && bLane === 0) || (aLane === 0 && bLane !== 0);

  let score = 0;
  if (oppositeWide) score += 58;
  if (bothCentral) score += 42;
  if (oneWideOneUnknown) score += 22;

  const defAtt =
    (aRole === "def" && (bRole === "att" || bRole === "mid")) ||
    (bRole === "def" && (aRole === "att" || aRole === "mid"));
  if (defAtt) score += oppositeWide ? 28 : bothCentral ? 18 : 10;

  if (aRole === "mid" && bRole === "mid") score += bothCentral ? 24 : oppositeWide ? 14 : 6;
  if (aRole === "att" && bRole === "att") score -= 22;
  if (aRole === "def" && bRole === "def") score -= oppositeWide ? 8 : 20;

  return clamp(score, 0, 100);
}

function starsFromScore(params: {
  score: number;
  primaryMarking: number;
  primaryFoulSignal: number;
  targetFoulSignal: number;
  contactCount: number;
  h2hFouls: number;
  hadCard: boolean;
}): number {
  const { score, primaryMarking, primaryFoulSignal, targetFoulSignal, contactCount, h2hFouls, hadCard } = params;

  const markingQuality = clamp((primaryMarking - 45) / 38, 0, 1.25);
  const primaryFoulQuality = clamp((primaryFoulSignal - 1.05) / 1.15, 0, 1.35);
  const targetFoulQuality = clamp((targetFoulSignal - 0.85) / 1.35, 0, 0.95);
  const multiContactQuality = contactCount >= 3 ? 0.45 : contactCount === 2 ? 0.25 : 0;
  const h2hQuality = clamp(h2hFouls / 3, 0, 0.35) + (hadCard ? 0.12 : 0);
  const starScore =
    1.25 +
    markingQuality +
    primaryFoulQuality +
    targetFoulQuality +
    multiContactQuality +
    h2hQuality +
    clamp((score - 2.2) / 3, 0, 0.45);

  // Rating più progressivo: 4 e 5 sono raggiungibili, ma solo con più segnali forti insieme.
  if (starScore >= 4.65 && primaryMarking >= 76 && primaryFoulSignal >= 1.55) return 5;
  if (starScore >= 3.85 && primaryMarking >= 64 && primaryFoulSignal >= 1.3) return 4;
  if (starScore >= 3.0 && primaryMarking >= 52 && primaryFoulSignal >= 1.12) return 3;
  if (starScore >= 2.2) return 2;
  return 1;
}

function playerStableKey(m: TacticalMetrics): string {
  const name = m.playerName.replace(/\s+/g, " ").trim().toUpperCase();
  return `${m.teamId}|${name}`;
}

function buildJustification(params: {
  target: TacticalMetrics;
  markers: FoulRiskAggressorBrief[];
  kind: FoulRiskAnalysisKind;
  stars: number;
}): string {
  const { target, markers, kind, stars } = params;
  const marker = markers[0];
  if (!marker) return "";
  const targetPos = positionLabel(target.positionCode);
  const markerPos = positionLabel(marker.positionCode);
  const extra =
    markers.length > 1
      ? ` Oltre al marcatore principale, ci sono altri ${markers.length - 1} possibili contatti nello stesso settore.`
      : "";
  if (kind === "suffered") {
    return (
      `${target.playerName} (${targetPos}) può essere marcato da ${marker.playerName} (${markerPos}). ` +
      `La marcatura principale pesa ${marker.markingScore}/100 e l'avversario commette circa ` +
      `${marker.foulsCommittedSeasonAvg.toFixed(2)} falli a partita.${extra} Rating finale: ${stars}/5 stelle.`
    );
  }

  return (
    `${target.playerName} (${targetPos}) può dover marcare ${marker.playerName} (${markerPos}). ` +
    `La marcatura principale pesa ${marker.markingScore}/100 e l'avversario subisce circa ` +
    `${marker.foulsSufferedSeasonAvg.toFixed(2)} falli a partita.${extra} Rating finale: ${stars}/5 stelle.`
  );
}

/**
 * Analisi predittiva “rischio falli” basata su posizione prevista e probabili marcature.
 * Non usa la heatmap: il driver è "chi marcherà chi" + medie falli commessi/subiti.
 */
export function analyzeFoulRisk(params: {
  metrics: TacticalMetrics[];
  homeTeamId: number;
  awayTeamId: number;
  kind: FoulRiskAnalysisKind;
}): FoulRiskEntry[] {
  const { metrics, homeTeamId, awayTeamId, kind } = params;
  const teamIds = new Set([homeTeamId, awayTeamId]);
  const players = metrics.filter((m) => teamIds.has(m.teamId) && m.roleIcon !== "🧤");

  const results: FoulRiskEntry[] = [];

  for (const p1 of players) {
    const opponents = players.filter((m) => m.teamId !== p1.teamId);
    const hits: Array<{
      opp: TacticalMetrics;
      marking: number;
      score: number;
      foulSignal: number;
      key: string;
    }> = [];

    for (const p2 of opponents) {
      const marking = markingMatchScore(p1, p2);
      if (marking < 45) continue;
      const markingFactor = marking / 100;
      if (kind === "suffered") {
        const opponentCommitted = committedSignal(p2);
        const targetSuffered = sufferedSignal(p1);
        if (opponentCommitted >= 1.1 && targetSuffered >= 0.9) {
          hits.push({
            opp: p2,
            marking,
            foulSignal: opponentCommitted,
            key: playerStableKey(p2),
            score:
              markingFactor * 1.35 +
              Math.max(0, opponentCommitted - 0.75) * 1.05 +
              Math.max(0, targetSuffered - 0.65) * 0.45
          });
        }
      } else {
        const targetCommitted = committedSignal(p1);
        const opponentSuffered = sufferedSignal(p2);
        if (targetCommitted >= 1.0 && opponentSuffered >= 1.1) {
          hits.push({
            opp: p2,
            marking,
            foulSignal: opponentSuffered,
            key: playerStableKey(p2),
            score:
              markingFactor * 1.35 +
              Math.max(0, targetCommitted - 0.7) * 0.95 +
              Math.max(0, opponentSuffered - 0.75) * 0.7
          });
        }
      }
    }

    if (hits.length === 0) continue;

    hits.sort((a, b) => b.score - a.score);
    const uniqueHits: typeof hits = [];
    const usedOpponentKeys = new Set<string>();
    for (const hit of hits) {
      if (usedOpponentKeys.has(hit.key)) continue;
      usedOpponentKeys.add(hit.key);
      uniqueHits.push(hit);
      if (uniqueHits.length >= 3) break;
    }
    const topHits = uniqueHits;
    const topHit = topHits[0];
    const targetFoulSignal = kind === "suffered" ? sufferedSignal(p1) : committedSignal(p1);
    const secondaryPressure = Math.min(
      0.9,
      topHits.slice(1).reduce((sum, hit, index) => sum + hit.score * (index === 0 ? 0.26 : 0.16), 0)
    );
    const multiContactBonus = topHits.length >= 3 ? 0.28 : topHits.length === 2 ? 0.16 : 0;
    const baseScore = topHit.score + secondaryPressure + multiContactBonus;
    const h2hFouls =
      kind === "suffered" ? (p1.h2hFoulsSuffered ?? 0) : (p1.h2hFoulsCommitted ?? 0);
    const riskScore = baseScore + clamp(h2hFouls * 0.12, 0, 0.35) + (p1.h2hHadCard ? 0.12 : 0);
    const starRating = starsFromScore({
      score: riskScore,
      primaryMarking: topHit.marking,
      primaryFoulSignal: topHit.foulSignal,
      targetFoulSignal,
      contactCount: topHits.length,
      h2hFouls,
      hadCard: Boolean(p1.h2hHadCard)
    });
    if (starRating < 3) continue;

    const markers: FoulRiskAggressorBrief[] = topHits.map((hit) => ({
      playerName: hit.opp.playerName,
      team: hit.opp.team,
      positionCode: hit.opp.positionCode,
      markingScore: Math.round(hit.marking),
      riskContribution: Math.round(hit.score * 100) / 100,
      foulsCommittedSeasonAvg: hit.opp.foulsCommittedSeasonAvg,
      foulsSufferedSeasonAvg: hit.opp.foulsSufferedSeasonAvg
    }));

    results.push({
      playerId: p1.playerId,
      playerName: p1.playerName,
      team: p1.team,
      teamId: p1.teamId,
      clubColor: p1.clubColor,
      kind,
      riskScore,
      starRating,
      markerPositionCode: topHit.opp.positionCode,
      matchupScore: Math.round(topHit.marking),
      aggressors: markers,
      justification: buildJustification({
        target: p1,
        markers,
        kind,
        stars: starRating
      })
    });
  }

  const bestByPlayer = new Map<string, FoulRiskEntry>();
  for (const row of results) {
    const key = `${row.teamId}|${row.playerName.replace(/\s+/g, " ").trim().toUpperCase()}`;
    const prev = bestByPlayer.get(key);
    if (!prev || row.riskScore > prev.riskScore) {
      bestByPlayer.set(key, row);
    }
  }

  return Array.from(bestByPlayer.values())
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);
}
