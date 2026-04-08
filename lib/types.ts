export interface Organization {
  id: string;
  name: string;
  allowed_ip: string;
  allowed_ip_ranges: string[];
  subscription_id: string | null;
  created_at: string;
}

export interface PlayerStat {
  id: string;
  organization_id: string;
  player_name: string;
  team: string;
  shots: number;
  fouls: number;
  saves: number;
  heatmap_data: Record<string, unknown>;
  last_updated: string;
}

/**
 * Doppia mappa posizioni sul campo per analisi tecnica; coordinate 0–100 come da API stagionale.
 * Con contesto partita, entrambe le serie sono nel sistema della squadra di casa (heatmap ospite
 * ribaltata lungo l’asse lungo); senza contesto, `pointsB` resta allineata allo stesso frame di `pointsA`
 * tramite ribaltamento rispetto al primo giocatore scelto dal modello.
 */
export interface SparkFrictionHeatmapPayload {
  labelA: string;
  labelB: string;
  clubColorA: string;
  clubColorB: string;
  pointsA: Array<{ x: number; y: number; intensity?: number }>;
  pointsB: Array<{ x: number; y: number; intensity?: number }>;
}

export interface TacticalMetrics {
  /** ID giocatore provider (quando disponibile): evita collisioni di nome. */
  playerId?: number;
  playerName: string;
  jerseyNumber: number;
  roleIcon: "🛡️" | "⚡" | "🎯" | "🧤";
  team: string;
  teamId: number;
  clubColor: string;
  firepowerIndex: number;
  firepowerDeltaPct: number;
  firepowerEditorial: string | null;
  sparkIndex: number;
  sparkNarrative: string;
  /** Motivazione leggibile: medie falli stagione/ultimi match e ruolo delle heatmap. */
  sparkFrictionExplanation?: string | null;
  /** Sovrapposizione visiva sul campo tra i due giocatori del duello. */
  sparkFrictionHeatmap?: SparkFrictionHeatmapPayload | null;
  sparkZone: {
    x: number;
    y: number;
    glow: number;
  };
  sparkDuel: {
    playerA: string;
    playerB: string;
    playerAId?: number;
    playerBId?: number;
    foulsCommittedA: number;
    foulsSufferedB: number;
  } | null;
  wallIndex: number;
  shotsSeasonAvg: number;
  shotsLastTwoAvg: number;
  savesSeasonAvg: number;
  savesLastTwoAvg: number;
  opponentShotsOnTargetSeasonAvg: number;
  opponentShotsOnTargetLeagueAvg: number;
  opponentShotsOnTargetLastTwoAvg: number;
  opponentShotsOnTargetLastTwoLeagueAvg: number;
  foulsCommittedSeasonAvg: number;
  foulsCommittedLastTwoAvg: number;
  foulsSufferedSeasonAvg: number;
  foulsSufferedLastTwoAvg: number;
  /** Partite campionate per la media "ultimi 2" (0 = nessun dato reale, evitare confronto con la stagione). */
  shotsLastTwoSampleCount?: number;
  savesLastTwoSampleCount?: number;
  foulsCommittedLastTwoSampleCount?: number;
  foulsSufferedLastTwoSampleCount?: number;
  lastUpdated: string;
}

export interface TacticalSnapshotRow {
  id: string;
  organization_id: string;
  fixture_id: string;
  metrics: TacticalMetrics[];
  source_status: string;
  updated_at: string;
  created_at: string;
}

/** Slide del programma `/display` (Serie A: scontri + top tiratori). */
export type DisplayProgramSlide =
  | {
      kind: "friction";
      eventId: number;
      kickoffLabel: string;
      matchTitle: string;
      competitionLabel: string;
      narrative: string;
      frictionExplanation: string | null;
      heatmap: SparkFrictionHeatmapPayload;
    }
  | {
      kind: "shooters";
      eventId: number;
      kickoffLabel: string;
      matchTitle: string;
      competitionLabel: string;
      /** Se i tiratori sono spezzati su più slide (es. "Parte 2 di 3"). */
      chunkHint?: string;
      players: Array<{
        rank: number;
        playerName: string;
        team: string;
        clubColor: string;
        jerseyNumber: number;
        shotsLastTwoAvg: number;
        shotsLastTwoSampleCount: number;
        roleIcon: TacticalMetrics["roleIcon"];
      }>;
    };

/**
 * `serie_a_today`: solo Serie A con kick-off oggi (fuso display).
 * `serie_a_next`: nessuna Serie A oggi → prossime partite tra Serie A, Champions ed Europa (ordine per data kick-off).
 */
export type DisplayProgramContext = "serie_a_today" | "serie_a_next";

export interface DisplayProgramPayload {
  slides: DisplayProgramSlide[];
  updatedAt: string;
  sourceStatus: "ok" | "empty" | "error";
  programContext?: DisplayProgramContext;
}

export interface SportPerformanceInput {
  /** ID atleta provider (quando disponibile). */
  athleteId?: number;
  athleteName: string;
  team: string;
  teamId: number;
  jerseyNumber: number;
  role: string;
  clubColor: string;
  shotsTotal: number;
  shotsLastTwoAvg: number;
  shotsSeasonAvg: number;
  opponentShotsConcededTotal: number;
  leagueAvgShotsConceded: number;
  foulsCommitted: number;
  foulsSuffered: number;
  foulsCommittedSeasonAvg: number;
  foulsCommittedLastTwoAvg: number;
  foulsSufferedSeasonAvg: number;
  foulsSufferedLastTwoAvg: number;
  opponentExpectedGoalsCreated: number;
  savePercentage: number;
  savesSeasonAvg: number;
  savesLastTwoAvg: number;
  opponentShotsOnTargetSeasonAvg: number;
  opponentShotsOnTargetLeagueAvg: number;
  opponentShotsOnTargetLastTwoAvg: number;
  opponentShotsOnTargetLastTwoLeagueAvg: number;
  heatmapPoints: Array<{ x: number; y: number; intensity?: number }>;
  shotsLastTwoSampleCount: number;
  savesLastTwoSampleCount: number;
  foulsCommittedLastTwoSampleCount: number;
  foulsSufferedLastTwoSampleCount: number;
}

export type CompetitionScope = "DOMESTIC" | "CUP" | "EUROPE";

export interface OffensiveBlueprintMetrics {
  goalsArea: number;
  goalsOutside: number;
  goalsLeft: number;
  goalsRight: number;
  goalsHead: number;
  bigChancesCreated: number;
  bigChancesMissed: number;
  shotsOn: number;
  shotsOff: number;
  shotsBlocked: number;
  dribbles: number;
  corners: number;
  freeKicksGoals: number;
  freeKicksTotal: number;
  penaltiesScored: number;
  penaltiesTotal: number;
  counterattacks: number;
  offsides: number;
  woodwork: number;
}

export interface DefensiveBlueprintMetrics {
  cleanSheets: number;
  goalsConceded: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  recoveries: number;
  errorsToShot: number;
  errorsToGoal: number;
  penaltiesConceded: number;
  goalLineClearances: number;
  lastManFoul: number;
  foulsCommitted: number;
  yellowCards: number;
  redCards: number;
}

export interface TeamPerformanceBlueprint {
  teamId: number;
  teamName: string;
  scope: CompetitionScope;
  competitions: string[];
  offensive: OffensiveBlueprintMetrics;
  defensive: DefensiveBlueprintMetrics;
}
