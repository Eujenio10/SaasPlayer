import { reweightAvailableMetrics, normalizeMinMax, normalizePercentile } from "@/lib/player-performance/normalize";
import { round0 } from "@/lib/player-performance/per90";

export interface IndexedScorePeer {
  playerId: string;
  values: Record<string, number>;
}

export function calculateWeightedIndexedScore(params: {
  playerId: string;
  values: Record<string, number | null>;
  weights: Record<string, number>;
  availableKeys: string[];
  peers: IndexedScorePeer[];
  roleFilter?: (peer: IndexedScorePeer) => boolean;
}): number | null {
  const available = params.availableKeys.filter(
    (key) => params.values[key] != null && Number.isFinite(params.values[key] as number)
  );
  if (!available.length) return null;

  const weights = reweightAvailableMetrics(params.weights, available);
  const filteredPeers = params.peers.filter(
    (peer) => peer.playerId !== params.playerId && (!params.roleFilter || params.roleFilter(peer))
  );
  const comparisonPool = filteredPeers.length ? filteredPeers : params.peers.filter((p) => p.playerId !== params.playerId);

  let score = 0;
  for (const key of available) {
    const value = params.values[key] as number;
    const peerValues = comparisonPool.map((peer) => peer.values[key] ?? 0);
    const usePercentile = peerValues.length >= 4;
    const normalized = usePercentile
      ? normalizePercentile(value, [...peerValues, value])
      : peerValues.length
        ? normalizeMinMax(value, Math.min(...peerValues, value), Math.max(...peerValues, value))
        : 50;
    score += normalized * weights[key];
  }

  return round0(Math.max(0, Math.min(100, score)));
}
