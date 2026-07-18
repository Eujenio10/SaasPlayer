import { clamp, sampleTruncatedNormal, SeededRandom } from "@/lib/match-simulator/math";
import type {
  MatchPhysicalityProfile,
  MatchTempoProfile,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

export function sampleMatchTempo(
  rng: SeededRandom,
  home: TeamSimulationProfile,
  away: TeamSimulationProfile
): MatchTempoProfile {
  const styleSignal =
    (home.playStyle.tempo + away.playStyle.tempo - 1.2) * 0.08 +
    (home.playStyle.attackingVolume + away.playStyle.attackingVolume - 1) * 0.06;
  const expected = clamp(1 + styleSignal, 0.88, 1.12);
  const sampled = sampleTruncatedNormal(rng, expected, 0.06, 0.85, 1.15);
  return {
    expectedTempo: sampled,
    variance: 0.06,
    label: tempoLabel(sampled)
  };
}

export function sampleMatchPhysicality(
  rng: SeededRandom,
  home: TeamSimulationProfile,
  away: TeamSimulationProfile
): MatchPhysicalityProfile {
  const expected =
    0.96 +
    (home.playStyle.physicalIntensity + away.playStyle.physicalIntensity - 1) * 0.12 +
    (home.disciplinaryProfile.recentPhysicality + away.disciplinaryProfile.recentPhysicality - 2) *
      0.05;
  const sampled = sampleTruncatedNormal(rng, expected, 0.1, 0.82, 1.18);
  return {
    expectedPhysicality: sampled,
    variance: 0.1,
    label: physicalityLabel(sampled)
  };
}

function tempoLabel(value: number): MatchTempoProfile["label"] {
  if (value >= 1.2) return "very_high";
  if (value >= 1.08) return "high";
  if (value >= 0.95) return "average";
  if (value >= 0.85) return "below_average";
  return "low";
}

function physicalityLabel(value: number): MatchPhysicalityProfile["label"] {
  if (value >= 1.25) return "very_high";
  if (value >= 1.1) return "high";
  if (value >= 0.95) return "average";
  if (value >= 0.85) return "below_average";
  return "low";
}

export function possessionAdjustmentFromProfiles(
  homePossessionExpected: number,
  tempo: MatchTempoProfile
): number {
  return clamp(homePossessionExpected * (0.98 + (tempo.expectedTempo - 1) * 0.04), 20, 80);
}
