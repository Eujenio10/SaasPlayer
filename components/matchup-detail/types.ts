import type { SparkFrictionHeatmapPayload } from "@/lib/types";

export type MatchupAccent = "blue" | "red";

export interface MatchupPlayerModel {
  firstName: string;
  lastName: string;
  team: string;
  roleLabel: string;
  /** Es. DC, AS — sintetizzato dall’analisi. */
  position: string;
  /** Codice formazione quando disponibile (AML, RW…), per QA heatmap. */
  tacticalPositionCode?: string;
  accent: MatchupAccent;
}

export interface ComparisonMetricModel {
  id: string;
  label: string;
  valueLeft: number;
  valueRight: number;
  showYellowCards?: boolean;
}

export interface MatchupReasonModel {
  id: string;
  title: string;
  description: string;
}

export interface MatchupDetailModel {
  rank: number;
  subtitle: string;
  playerA: MatchupPlayerModel;
  playerB: MatchupPlayerModel;
  collisionScore: number;
  collisionDescription: string;
  collisionScoreLabel: string;
  metrics: ComparisonMetricModel[];
  heatmap: SparkFrictionHeatmapPayload | null;
  reasons: MatchupReasonModel[];
  updatedAtLabel: string;
}
