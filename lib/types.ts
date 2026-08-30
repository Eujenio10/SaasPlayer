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
 * Con contesto partita (homeTeamId), le posizioni della trasferta sono normalizzate allo stesso
 * riferimento della squadra di casa prima del confronto. Senza contesto, `pointsB` usa un
 * ribaltamento solo-X rispetto al primo giocatore del modello (legacy).
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
  /** Posizione/codice da formazione prevista o lineup provider (es. DC, DR, DL, MR, AML). */
  positionCode?: string;
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
  shotsLastFiveAvg: number;
  savesSeasonAvg: number;
  savesLastTwoAvg: number;
  savesLastFiveAvg: number;
  opponentShotsOnTargetSeasonAvg: number;
  opponentShotsOnTargetLeagueAvg: number;
  opponentShotsOnTargetLastTwoAvg: number;
  opponentShotsOnTargetLastTwoLeagueAvg: number;
  foulsCommittedSeasonAvg: number;
  foulsCommittedLastTwoAvg: number;
  foulsCommittedLastFiveAvg: number;
  foulsSufferedSeasonAvg: number;
  foulsSufferedLastTwoAvg: number;
  foulsSufferedLastFiveAvg: number;
  /** Minuti giocati nel campione stagione (per p90 vero). */
  seasonMinutesPlayed?: number;
  /** Presenze nel campione stagione (allineate ai minuti). */
  seasonAppearances?: number;
  /** Falli commessi p90 (falli ÷ minuti × 90) quando i minuti sono disponibili. */
  foulsCommittedSeasonP90?: number;
  /** Falli subiti p90 quando i minuti sono disponibili. */
  foulsSufferedSeasonP90?: number;
  /** Presenze nella stagione in corso del torneo analizzato (serie eventi, non overall anno precedente). */
  currentSeasonSampleCount?: number;
  /** Dribbling riusciti/registrati a partita, quando il provider espone la statistica. */
  dribblesSeasonAvg?: number;
  /** Partite campionate per la media "ultimi 2" (0 = nessun dato reale, evitare confronto con la stagione). */
  shotsLastTwoSampleCount?: number;
  savesLastTwoSampleCount?: number;
  foulsCommittedLastTwoSampleCount?: number;
  foulsSufferedLastTwoSampleCount?: number;
  shotsLastFiveSampleCount?: number;
  savesLastFiveSampleCount?: number;
  foulsCommittedLastFiveSampleCount?: number;
  foulsSufferedLastFiveSampleCount?: number;
  lastUpdated: string;
  /**
   * Punti heatmap stagionali nel frame della squadra di casa (stesso orientamento degli scontri friction).
   * Presente quando `match-insights` costruisce le metriche con `homeTeamId`.
   */
  heatmapPointsMatchFrame?: Array<{ x: number; y: number; intensity?: number }>;
  /**
   * true se il profilo è nella XI prevista (o ultimo XI titolare, esclusi infortunati).
   * Scontri & Falli include anche panchinari sopra soglia falli.
   * Marcature: XI + offensivi con falli subiti/dribbling alti anche se il provider
   * li ha marcati come non titolari (es. Paz, Mastantuono).
   */
  probableStarter?: boolean;
  /** true se il giocatore è in missingPlayers della formazione (infortunato/squalificato). */
  unavailableForMatch?: boolean;

  /**
   * Ultimo scontro diretto (H2H) vs avversaria del match selezionato.
   * Valori opzionali: presenti solo quando `match-insights` riesce a risalire all’ultimo H2H e ai lineups.
   */
  h2hEventId?: number;
  /** Tot falli/cartellini nell’ultimo scontro diretto H2H recuperato (non medie a partita). */
  h2hFoulsCommitted?: number;
  h2hFoulsSuffered?: number;
  h2hYellowCards?: number;
  h2hRedCards?: number;
  h2hHadCard?: boolean;

  /**
   * Linee player props (OddsPapi) per il match selezionato.
   * Popolate solo se configurata `ODDSAPI_RAPIDAPI_KEY` e se il provider ritorna quel mercato per la fixture.
   */
  oddsFoulsCommittedLine?: number;
  oddsFoulsCommittedOver?: number;
  oddsFoulsCommittedUnder?: number;
  oddsCardsLine?: number;
  oddsCardsOver?: number;
  oddsCardsUnder?: number;
  oddsBookmaker?: string;
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
  /** `organization_db_empty`: nessun programma salvato dagli admin (lettura Pro senza RapidAPI). */
  sourceStatus: "ok" | "empty" | "error" | "organization_db_empty";
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
  /** Codice posizione grezzo dalla formazione (es. DL, MR, AML): per affinità tattica / fasce. */
  positionCode?: string;
  clubColor: string;
  shotsTotal: number;
  shotsLastTwoAvg: number;
  shotsLastFiveAvg: number;
  shotsSeasonAvg: number;
  opponentShotsConcededTotal: number;
  leagueAvgShotsConceded: number;
  foulsCommitted: number;
  foulsSuffered: number;
  foulsCommittedSeasonAvg: number;
  foulsCommittedLastTwoAvg: number;
  foulsCommittedLastFiveAvg: number;
  foulsSufferedSeasonAvg: number;
  foulsSufferedLastTwoAvg: number;
  foulsSufferedLastFiveAvg: number;
  seasonMinutesPlayed?: number;
  seasonAppearances?: number;
  foulsCommittedSeasonP90?: number;
  foulsSufferedSeasonP90?: number;
  /** Presenze nella stagione in corso del torneo analizzato. */
  currentSeasonSampleCount?: number;
  /** Dribbling riusciti/registrati a partita, quando il provider espone la statistica. */
  dribblesSeasonAvg?: number;
  opponentExpectedGoalsCreated: number;
  savePercentage: number;
  savesSeasonAvg: number;
  savesLastTwoAvg: number;
  savesLastFiveAvg: number;
  opponentShotsOnTargetSeasonAvg: number;
  opponentShotsOnTargetLeagueAvg: number;
  opponentShotsOnTargetLastTwoAvg: number;
  opponentShotsOnTargetLastTwoLeagueAvg: number;
  heatmapPoints: Array<{ x: number; y: number; intensity?: number }>;
  /** true se il giocatore è nella XI prevista della partita analizzata. */
  probableStarter?: boolean;
  /** true se il giocatore è in missingPlayers della formazione (infortunato/squalificato). */
  unavailableForMatch?: boolean;
  shotsLastTwoSampleCount: number;
  savesLastTwoSampleCount: number;
  foulsCommittedLastTwoSampleCount: number;
  foulsSufferedLastTwoSampleCount: number;
  shotsLastFiveSampleCount: number;
  savesLastFiveSampleCount: number;
  foulsCommittedLastFiveSampleCount: number;
  foulsSufferedLastFiveSampleCount: number;
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
  /** Tiri totali concessi agli avversari per partita. */
  shotsConceded?: number;
  /** Corner concessi agli avversari per partita. */
  cornersConceded?: number;
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
  /** Torneo FootApi da cui sono state lette le medie (stagione in corso della partita). */
  tournamentId?: number;
  /** Stagione FootApi da cui sono state lette le medie (es. 2026-27). */
  seasonId?: number;
  offensive: OffensiveBlueprintMetrics;
  defensive: DefensiveBlueprintMetrics;
}
