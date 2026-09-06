export type FantaRoleGroup = "goalkeeper" | "defender" | "midfielder" | "forward";

export type FantaTrendDirection = "up" | "stable" | "down";

export type FantaMatchupTone = "favorable" | "neutral" | "difficult";

export type FantaMatchupClassification = "favorevole" | "neutro" | "difficile";

export type FantaMatchupBucket = "favorevole" | "sfavorevole" | "neutro";

export type FantaDefenderLane = "central" | "fullback";

export interface FantaAppearance {
  fixtureId: string;
  date: string;
  opponentName: string;
  minutes: number;
  ratingApi: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  keyPasses: number | null;
  dribbles: number | null;
  saves: number | null;
  goalsConceded: number | null;
  starter: boolean;
  round: string | null;
}

export interface FantaScoreBreakdown {
  performance: number | null;
  production: number | null;
  consistency: number | null;
  matchup: number | null;
  pitchbrainFantaRating: number;
  usedFallback: boolean;
}

export interface FantaReason {
  code: string;
  text: string;
}

export interface FantaScoutPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  listRole: string | null;
  mantra: string | null;
  scores: FantaScoreBreakdown;
  lastRating: number | null;
  avgRating5: number | null;
  avgRating10: number | null;
  ratingDelta: number | null;
  trend: FantaTrendDirection;
  lastFive: FantaAppearance[];
  lastTenRatings: Array<number | null>;
  nextOpponentName: string | null;
  matchup: FantaMatchupCard | null;
  reasons: FantaReason[];
}

export interface FantaMatchupCard {
  matchupId: string;
  eventId: number;
  playerId: string;
  playerName: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  roleLabel: string;
  mantra: string | null;
  nextOpponentName: string | null;
  fixtureLabel: string;
  matchupScore: number;
  classification: FantaMatchupClassification;
  tone: FantaMatchupTone;
  headline: string;
  positiveFactors: string[];
  negativeFactors: string[];
  lens: FantaRoleGroup;
  dailyScore: number;
  bucket: FantaMatchupBucket;
  defenderLane: FantaDefenderLane | null;
  markingOpponentName: string | null;
  avgRating5: number | null;
  attackerName: string;
  attackerTeamName: string;
  defenderName: string;
  defenderTeamName: string;
  attacker: {
    dribblesPer90: number | null;
    foulsDrawnPer90: number | null;
    avgRating: number | null;
    shotsHint: number | null;
  };
  defender: {
    dribblesConcededHint: number | null;
    foulsCommittedPer90: number | null;
    yellowPer90: number | null;
    vulnerability: number | null;
  };
  reasons: FantaReason[];
}

export interface FantaMatchupLane {
  favorevoli: FantaMatchupCard[];
  sfavorevoli: FantaMatchupCard[];
}

export interface FantaMatchupBriefing {
  goalkeeper: FantaMatchupLane;
  centralDefender: FantaMatchupLane;
  fullback: FantaMatchupLane;
  midfielder: FantaMatchupLane;
  forward: FantaMatchupLane;
}

export interface FantaRankingRow {
  rank: number;
  playerId: string;
  playerName: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  listRole: string | null;
  mantra: string | null;
  rating: number;
  form: FantaTrendDirection;
  avgRating5: number | null;
}

export interface FantaTrendRow {
  playerId: string;
  playerName: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  ratings: number[];
  trend: FantaTrendDirection;
  avgRecent: number | null;
  pitchbrainFantaRating: number;
}

export interface FantaLineupPick {
  playerId: string;
  playerName: string;
  roleGroup: FantaRoleGroup;
  rating: number;
  reasons: FantaReason[];
  nextOpponentName: string | null;
}

export interface FantaPlayerSearchHit {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  listRole: string | null;
  mantra: string | null;
}

export interface FantaDuelSide {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  mantra: string | null;
  fantaScore: number;
  avgRating5: number | null;
  lastRating: number | null;
  nextOpponentName: string | null;
  trend: FantaTrendDirection;
}

export interface FantaDuelPillar {
  id:
    | "recent"
    | "production"
    | "contribution"
    | "minutes"
    | "teamContext"
    | "opponent"
    | "teamForm";
  label: string;
  weight: number;
  scoreA: number | null;
  scoreB: number | null;
  winner: "a" | "b" | "tie";
  detailA: string;
  detailB: string;
  edgeLabel: string | null;
}

export interface FantaDuelResult {
  playerA: FantaDuelSide;
  playerB: FantaDuelSide;
  pillars: FantaDuelPillar[];
  recommended: "a" | "b" | "tie";
  motivation: string;
}

export type FantaTrendCategory = "rising" | "falling" | "best5" | "best10";

export interface FantaComputedPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
  listRole: string | null;
  mantra: string | null;
  competitionId: string;
  seasonId: string;
  appearances: FantaAppearance[];
  scores: FantaScoreBreakdown;
  lastRating: number | null;
  avgRating5: number | null;
  avgRating10: number | null;
  ratingDelta: number | null;
  trend: FantaTrendDirection;
  nextOpponentName: string | null;
  matchup: FantaMatchupCard | null;
  reasons: FantaReason[];
}
