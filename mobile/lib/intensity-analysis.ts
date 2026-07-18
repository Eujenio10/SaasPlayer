/**
 * Analisi tecnico-sportiva intensità partita — funzioni pure, nessuna I/O.
 * Usa medie falli già presenti in TacticalMetrics (proxy p90 ≈ media a partita).
 */

export type IntensityLevel = "low" | "medium" | "high" | "very_high";
export type DataReliabilityLevel = "low" | "medium" | "good" | "high";

export interface IntensityPlayerInput {
  playerId?: number;
  playerName: string;
  team: string;
  teamId: number;
  positionCode?: string;
  roleIcon?: string;
  foulsCommittedSeasonAvg?: number;
  foulsCommittedLastTwoAvg?: number;
  foulsCommittedLastFiveAvg?: number;
  foulsSufferedSeasonAvg?: number;
  foulsSufferedLastTwoAvg?: number;
  foulsSufferedLastFiveAvg?: number;
  foulsCommittedLastTwoSampleCount?: number;
  foulsSufferedLastTwoSampleCount?: number;
  foulsCommittedLastFiveSampleCount?: number;
  foulsSufferedLastFiveSampleCount?: number;
  sparkIndex?: number;
  sparkNarrative?: string;
  sparkDuel?: {
    playerA: string;
    playerB: string;
    playerAId?: number;
    playerBId?: number;
    foulsCommittedA: number;
    foulsSufferedB: number;
  } | null;
}

export interface PlayerIntensityMetrics {
  playerId?: number;
  playerName: string;
  team: string;
  teamId: number;
  positionCode?: string;
  roleIcon?: string;
  roleLabel: string;
  foulsCommittedP90: number | null;
  foulsSufferedP90: number | null;
  foulsDiffP90: number | null;
  aggressionProfile: string;
  contactExposure: string;
  reliability: DataReliabilityLevel;
  reliabilityNote: string;
  estimatedMinutes: number;
  trendCommitted: "up" | "down" | "stable" | "unavailable";
  trendSuffered: "up" | "down" | "stable" | "unavailable";
  trendNote: string;
}

export interface MatchIntensityIndex {
  value: number | null;
  level: IntensityLevel;
  label: string;
  explanation: string;
  playersUsed: number;
}

export interface HighIntensityDuel {
  playerA: string;
  teamA: string;
  playerB: string;
  teamB: string;
  playerAId?: number;
  playerBId?: number;
  zoneLabel: string;
  duelScore: number;
  reading: string;
}

export interface PressureZoneSummary {
  zoneId: string;
  zoneLabel: string;
  avgCommittedP90: number;
  avgSufferedP90: number;
  playerCount: number;
  intensityLevel: IntensityLevel;
  summary: string;
  topPlayers: string[];
}

export interface RoleGroupSummary {
  roleGroup: string;
  roleLabel: string;
  topAggressive: PlayerIntensityMetrics[];
  topExposed: PlayerIntensityMetrics[];
  topDiff: PlayerIntensityMetrics[];
}

export interface MatchIntensityAnalysis {
  matchIntensity: MatchIntensityIndex;
  aggressivePlayers: PlayerIntensityMetrics[];
  exposedPlayers: PlayerIntensityMetrics[];
  highIntensityDuels: HighIntensityDuel[];
  pressureZones: PressureZoneSummary[];
  roleGroups: RoleGroupSummary[];
  reliabilityOverview: {
    level: DataReliabilityLevel;
    note: string;
    lowSampleCount: number;
    totalPlayers: number;
  };
  technicalSummary: string;
  trendAvailable: boolean;
}

const MIN_WEIGHT_MINUTES = 180;

/** Soglia minima media falli per profili in evidenza (commessi / subiti). */
export const FOULS_PROFILE_MIN_AVG = 1.2;

/** Duelli da monitorare mostrati per partita. */
export const MATCH_MONITOR_DUELS_COUNT = 4;

function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function roundMetric(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function formatMetric(n: number | null, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "n.d.";
  return roundMetric(n, decimals).toFixed(decimals);
}

/** Minuti stimati dal campione partite disponibile (≈ 90 min a uscita). */
export function estimatePlayerMinutes(m: IntensityPlayerInput): number {
  const samples = [
    safeNum(m.foulsCommittedLastFiveSampleCount),
    safeNum(m.foulsSufferedLastFiveSampleCount),
    safeNum(m.foulsCommittedLastTwoSampleCount),
    safeNum(m.foulsSufferedLastTwoSampleCount)
  ].filter((n): n is number => n != null && n > 0);
  if (!samples.length) {
    if (committedPerMatch(m) != null || sufferedPerMatch(m) != null) {
      return 270;
    }
    return 0;
  }
  return Math.max(...samples) * 90;
}

export function dataReliabilityFromMinutes(minutes: number): {
  level: DataReliabilityLevel;
  note: string;
} {
  if (minutes <= 0) {
    return { level: "low", note: "Campione limitato: lettura da interpretare con cautela." };
  }
  if (minutes <= 180) {
    return { level: "low", note: "Dato interessante, ma con campione ridotto." };
  }
  if (minutes <= 450) {
    return { level: "medium", note: "Affidabilità media: utile per orientamento tattico." };
  }
  if (minutes <= 900) {
    return { level: "good", note: "Buona affidabilità statistica." };
  }
  return { level: "high", note: "Affidabilità alta sul campione disponibile." };
}

function pickFoulAverage(
  season: number | null,
  lastTwo: number | null,
  lastFive: number | null,
  lastTwoSamples: number | null,
  lastFiveSamples: number | null
): number | null {
  if (season != null && season >= 0) return season;
  if (lastFiveSamples != null && lastFiveSamples >= 2 && lastFive != null && lastFive >= 0) {
    return lastFive;
  }
  if (lastTwoSamples != null && lastTwoSamples >= 2 && lastTwo != null && lastTwo >= 0) {
    return lastTwo;
  }
  return null;
}

/** Media falli nel solo torneo/competizione analizzata (stagione corrente). */
function committedPerMatch(m: IntensityPlayerInput): number | null {
  return pickFoulAverage(
    safeNum(m.foulsCommittedSeasonAvg),
    safeNum(m.foulsCommittedLastTwoAvg),
    safeNum(m.foulsCommittedLastFiveAvg),
    safeNum(m.foulsCommittedLastTwoSampleCount),
    safeNum(m.foulsCommittedLastFiveSampleCount)
  );
}

function sufferedPerMatch(m: IntensityPlayerInput): number | null {
  return pickFoulAverage(
    safeNum(m.foulsSufferedSeasonAvg),
    safeNum(m.foulsSufferedLastTwoAvg),
    safeNum(m.foulsSufferedLastFiveAvg),
    safeNum(m.foulsSufferedLastTwoSampleCount),
    safeNum(m.foulsSufferedLastFiveSampleCount)
  );
}

/** Proxy p90: medie a partita ≈ falli ogni 90 min quando il giocatore gioca l'intera gara. */
export function foulsCommittedP90(m: IntensityPlayerInput): number | null {
  const perMatch = committedPerMatch(m);
  if (perMatch == null) return null;
  return roundMetric(perMatch);
}

export function foulsSufferedP90(m: IntensityPlayerInput): number | null {
  const perMatch = sufferedPerMatch(m);
  if (perMatch == null) return null;
  return roundMetric(perMatch);
}

export function aggressionProfileLabel(p90: number | null): string {
  if (p90 == null) return "Dato non disponibile";
  if (p90 <= 0.7) return "Basso coinvolgimento nei falli";
  if (p90 <= 1.5) return "Profilo equilibrato";
  if (p90 <= 2.3) return "Profilo aggressivo";
  return "Alta intensità nei contrasti";
}

export function contactExposureLabel(p90: number | null): string {
  if (p90 == null) return "Dato non disponibile";
  if (p90 <= 0.7) return "Bassa esposizione ai contatti";
  if (p90 <= 1.5) return "Esposizione normale";
  if (p90 <= 2.3) return "Giocatore spesso pressato";
  return "Alta esposizione alla pressione avversaria";
}

export function intensityLevelFromScore(score: number | null): {
  level: IntensityLevel;
  label: string;
} {
  if (score == null) return { level: "low", label: "Intensità non calcolabile" };
  if (score <= 0.8) return { level: "low", label: "Intensità bassa" };
  if (score <= 1.5) return { level: "medium", label: "Intensità media" };
  if (score <= 2.2) return { level: "high", label: "Intensità alta" };
  return { level: "very_high", label: "Intensità molto alta" };
}

function roleGroupFromPlayer(m: IntensityPlayerInput): { id: string; label: string } {
  const icon = m.roleIcon ?? "";
  if (icon === "🧤") return { id: "gk", label: "Portiere" };
  if (icon === "🛡️") return { id: "def", label: "Difensori" };
  if (icon === "🎯") return { id: "att", label: "Attaccanti" };
  if (icon === "⚡") return { id: "mid", label: "Centrocampo" };

  const code = (m.positionCode ?? "").toUpperCase();
  if (/^(G|GK)/.test(code)) return { id: "gk", label: "Portiere" };
  if (/^(D|DC|CB|DR|DL|SW|WB|LWB|RWB)/.test(code)) return { id: "def", label: "Difensori" };
  if (/^(F|FW|CF|ST|LW|RW|AML|AMR|SS)/.test(code)) return { id: "att", label: "Attaccanti" };
  return { id: "mid", label: "Centrocampo" };
}

export function tacticalZoneFromPosition(m: IntensityPlayerInput): { id: string; label: string } {
  const code = (m.positionCode ?? "").toUpperCase().trim();
  const icon = m.roleIcon ?? "";

  if (icon === "🧤" || /^(G|GK)/.test(code)) {
    return { id: "def_area", label: "Area difensiva" };
  }
  if (/^(DC|CB|SW)/.test(code) || (icon === "🛡️" && /C/.test(code))) {
    return { id: "def_central", label: "Difesa centrale" };
  }
  if (/^(DR|RWB|RB|WR)/.test(code) || /\bDR\b/.test(code)) {
    return { id: "def_right", label: "Fascia destra difensiva" };
  }
  if (/^(DL|LWB|LB|WL)/.test(code) || /\bDL\b/.test(code)) {
    return { id: "def_left", label: "Fascia sinistra difensiva" };
  }
  if (/^(DM|CDM|MD)/.test(code)) {
    return { id: "mid_central_deep", label: "Centrocampo centrale" };
  }
  if (/^(MC|CM|MF)/.test(code) || icon === "⚡") {
    return { id: "mid_central", label: "Centrocampo" };
  }
  if (/^(AM|CAM|OM|MP)/.test(code)) {
    return { id: "mid_att", label: "Rifinitura centrale" };
  }
  if (/^(MR|AMR|RW|WR)/.test(code)) {
    return { id: "att_right", label: "Fascia destra offensiva" };
  }
  if (/^(ML|AML|LW|WL)/.test(code)) {
    return { id: "att_left", label: "Fascia sinistra offensiva" };
  }
  if (/^(F|FW|CF|ST|SS)/.test(code) || icon === "🎯") {
    return { id: "att_central", label: "Ultimo terzo offensivo" };
  }
  if (icon === "🛡️") return { id: "def_central", label: "Difesa centrale" };
  return { id: "mid_central", label: "Centrocampo" };
}

function positionLane(positionCode?: string): -1 | 0 | 1 {
  const s = (positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return 0;
  if (/^(DL|LWB|LB|ML|AML|LW|LM|WL)(\/|$)/.test(s)) return -1;
  if (/^(DR|RWB|RB|MR|AMR|RW|RM|WR)(\/|$)/.test(s)) return 1;
  const last = s[s.length - 1];
  const first = s[0];
  if (last === "L" && /^[DAMFW]/.test(first)) return -1;
  if (last === "R" && /^[DAMFW]/.test(first)) return 1;
  return 0;
}

function roleBand(m: IntensityPlayerInput): "gk" | "def" | "mid" | "att" {
  const g = roleGroupFromPlayer(m).id;
  if (g === "gk") return "gk";
  if (g === "def") return "def";
  if (g === "att") return "att";
  return "mid";
}

function duelPairScore(a: IntensityPlayerInput, b: IntensityPlayerInput): number {
  const aRole = roleBand(a);
  const bRole = roleBand(b);
  if (aRole === "gk" || bRole === "gk") return 0;

  const aLane = positionLane(a.positionCode);
  const bLane = positionLane(b.positionCode);
  let tactical = 0;
  if (aLane !== 0 && bLane !== 0 && aLane === -bLane) tactical += 40;
  if (aLane === 0 && bLane === 0) tactical += 25;
  const defAtt =
    (aRole === "def" && (bRole === "att" || bRole === "mid")) ||
    (bRole === "def" && (aRole === "att" || aRole === "mid"));
  if (defAtt) tactical += 20;
  if (aRole === "mid" && bRole === "mid") tactical += 15;
  return tactical;
}

function duelReading(a: IntensityPlayerInput, b: IntensityPlayerInput): string {
  const aLane = positionLane(a.positionCode);
  const bLane = positionLane(b.positionCode);
  if (aLane !== 0 && bLane !== 0 && aLane === -bLane) {
    return "Duello laterale ad alta intensità";
  }
  if (roleBand(a) === "def" && roleBand(b) === "att") {
    return "Incrocio tecnico con alto coinvolgimento nei contrasti";
  }
  return "Possibile zona di contatto frequente";
}

function trendFromAvgs(
  season: number | null,
  recent: number | null,
  sampleCount: number | undefined
): "up" | "down" | "stable" | "unavailable" {
  if (season == null || recent == null || !sampleCount || sampleCount < 1) return "unavailable";
  const delta = recent - season;
  if (Math.abs(delta) < 0.15) return "stable";
  return delta > 0 ? "up" : "down";
}

function trendNote(
  committed: "up" | "down" | "stable" | "unavailable",
  suffered: "up" | "down" | "stable" | "unavailable"
): string {
  if (committed === "unavailable" && suffered === "unavailable") {
    return "Trend non disponibile per mancanza di storico.";
  }
  if (committed === "up" || suffered === "up") {
    return "Il giocatore ha aumentato il coinvolgimento nei falli rispetto alla sua media recente.";
  }
  if (committed === "stable" && suffered === "stable") return "Trend stabile.";
  if (committed === "down" && suffered === "down") {
    return "Trend in calo sul coinvolgimento nei contrasti.";
  }
  return "Trend misto tra falli commessi e subiti.";
}

export function buildPlayerIntensityMetrics(m: IntensityPlayerInput): PlayerIntensityMetrics {
  const minutes = estimatePlayerMinutes(m);
  const reliability = dataReliabilityFromMinutes(minutes);
  const committed = foulsCommittedP90(m);
  const suffered = foulsSufferedP90(m);
  const diff =
    committed != null && suffered != null ? roundMetric(committed - suffered) : null;
  const role = roleGroupFromPlayer(m);

  const trendCommitted = trendFromAvgs(
    safeNum(m.foulsCommittedSeasonAvg),
    safeNum(m.foulsCommittedLastTwoAvg),
    m.foulsCommittedLastTwoSampleCount
  );
  const trendSuffered = trendFromAvgs(
    safeNum(m.foulsSufferedSeasonAvg),
    safeNum(m.foulsSufferedLastTwoAvg),
    m.foulsSufferedLastTwoSampleCount
  );

  return {
    playerId: m.playerId,
    playerName: m.playerName,
    team: m.team,
    teamId: m.teamId,
    positionCode: m.positionCode,
    roleIcon: m.roleIcon,
    roleLabel: role.label,
    foulsCommittedP90: committed,
    foulsSufferedP90: suffered,
    foulsDiffP90: diff,
    aggressionProfile: aggressionProfileLabel(committed),
    contactExposure: contactExposureLabel(suffered),
    reliability: reliability.level,
    reliabilityNote: reliability.note,
    estimatedMinutes: minutes,
    trendCommitted,
    trendSuffered,
    trendNote: trendNote(trendCommitted, trendSuffered)
  };
}

export function computeMatchIntensityIndex(
  players: PlayerIntensityMetrics[]
): MatchIntensityIndex {
  const weighted = players.filter(
    (p) => p.foulsCommittedP90 != null && p.estimatedMinutes >= MIN_WEIGHT_MINUTES
  );
  if (!weighted.length) {
    return {
      value: null,
      level: "low",
      label: "Intensità non calcolabile",
      explanation: "Campione insufficiente per stimare l'intensità complessiva della gara.",
      playersUsed: 0
    };
  }

  let totalWeight = 0;
  let sum = 0;
  for (const p of weighted) {
    const w = p.estimatedMinutes;
    sum += (p.foulsCommittedP90 ?? 0) * w;
    totalWeight += w;
  }
  const value = totalWeight > 0 ? roundMetric(sum / totalWeight) : null;
  const { level, label } = intensityLevelFromScore(value);

  let explanation = "La gara mostra un livello medio di fisicità.";
  if (level === "very_high" || level === "high") {
    explanation =
      "La partita presenta diversi profili ad alta intensità nei contrasti.";
  } else if (level === "low") {
    explanation = "Il dato suggerisce un livello contenuto di fisicità nei duelli.";
  } else {
    const top = [...weighted].sort(
      (a, b) => (b.foulsCommittedP90 ?? 0) - (a.foulsCommittedP90 ?? 0)
    );
    const spread = (top[0]?.foulsCommittedP90 ?? 0) - (top[top.length - 1]?.foulsCommittedP90 ?? 0);
    if (spread >= 1.2) {
      explanation =
        "Il dato suggerisce una distribuzione dei falli concentrata su pochi giocatori.";
    }
  }

  return { value, level, label, explanation, playersUsed: weighted.length };
}

function normalizePlayerKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function duelPairDedupeKey(
  idA?: number,
  idB?: number,
  nameA?: string,
  nameB?: string
): string {
  const a = idA && idA > 0 ? `id:${idA}` : `n:${normalizePlayerKey(nameA ?? "")}`;
  const b = idB && idB > 0 ? `id:${idB}` : `n:${normalizePlayerKey(nameB ?? "")}`;
  return [a, b].sort().join("|");
}

function findMetricOpponent(
  metrics: IntensityPlayerInput[],
  playerId: number | undefined,
  playerName: string,
  excludeTeamId: number
): IntensityPlayerInput | undefined {
  if (playerId && playerId > 0) {
    const byId = metrics.find((m) => m.playerId === playerId && m.teamId !== excludeTeamId);
    if (byId) return byId;
  }
  const norm = normalizePlayerKey(playerName);
  return metrics.find(
    (m) => m.teamId !== excludeTeamId && normalizePlayerKey(m.playerName) === norm
  );
}

function buildHighIntensityDuels(
  metrics: IntensityPlayerInput[],
  homeTeamId?: number
): HighIntensityDuel[] {
  if (metrics.length < 2) return [];

  const pairs: HighIntensityDuel[] = [];
  const seen = new Set<string>();

  const addDuel = (duel: HighIntensityDuel) => {
    const key = duelPairDedupeKey(duel.playerAId, duel.playerBId, duel.playerA, duel.playerB);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(duel);
  };

  for (const m of metrics) {
    const spark = m.sparkDuel;
    const sparkIndex = m.sparkIndex ?? 0;
    if (!spark || sparkIndex < 10) continue;

    const opponent = findMetricOpponent(metrics, spark.playerBId, spark.playerB, m.teamId);
    const playerB = opponent?.playerName ?? spark.playerB;
    const teamB = opponent?.team ?? metrics.find((x) => x.teamId !== m.teamId)?.team ?? "";

    const foulScore = spark.foulsCommittedA + spark.foulsSufferedB;
    const duelScore = roundMetric(foulScore + sparkIndex / 20);
    const narrative = m.sparkNarrative?.trim();

    addDuel({
      playerA: m.playerName,
      teamA: m.team,
      playerB,
      teamB,
      playerAId: m.playerId ?? spark.playerAId,
      playerBId: opponent?.playerId ?? spark.playerBId,
      zoneLabel: tacticalZoneFromPosition(m).label,
      duelScore,
      reading:
        narrative && narrative.length > 12
          ? narrative
          : duelReading(m, opponent ?? m)
    });
  }

  const home = homeTeamId != null ? metrics.filter((m) => m.teamId === homeTeamId) : [];
  const away = homeTeamId != null ? metrics.filter((m) => m.teamId !== homeTeamId) : metrics;

  const sides =
    home.length && away.length
      ? home.flatMap((a) => away.map((b) => [a, b] as const))
      : [...new Set(metrics.map((m) => m.teamId))].length >= 2
        ? metrics.flatMap((a, i) =>
            metrics.slice(i + 1).filter((b) => b.teamId !== a.teamId).map((b) => [a, b] as const)
          )
        : [];

  for (const [a, b] of sides) {
    const cA = foulsCommittedP90(a);
    const sB = foulsSufferedP90(b);
    const cB = foulsCommittedP90(b);
    const sA = foulsSufferedP90(a);

    const scoreAB = cA != null && sB != null ? cA + sB + duelPairScore(a, b) * 0.02 : null;
    const scoreBA = cB != null && sA != null ? cB + sA + duelPairScore(b, a) * 0.02 : null;
    if (scoreAB == null && scoreBA == null) continue;

    const useAB = (scoreAB ?? 0) >= (scoreBA ?? 0);
    const duelScore = roundMetric(useAB ? scoreAB! : scoreBA!);
    if (duelScore < 1.2) continue;

    addDuel({
      playerA: useAB ? a.playerName : b.playerName,
      teamA: useAB ? a.team : b.team,
      playerB: useAB ? b.playerName : a.playerName,
      teamB: useAB ? b.team : a.team,
      playerAId: useAB ? a.playerId : b.playerId,
      playerBId: useAB ? b.playerId : a.playerId,
      zoneLabel: tacticalZoneFromPosition(useAB ? a : b).label,
      duelScore,
      reading: duelReading(useAB ? a : b, useAB ? b : a)
    });
  }

  return pairs.sort((a, b) => b.duelScore - a.duelScore).slice(0, MATCH_MONITOR_DUELS_COUNT);
}

function buildPressureZones(players: PlayerIntensityMetrics[]): PressureZoneSummary[] {
  const byZone = new Map<string, { label: string; players: PlayerIntensityMetrics[] }>();

  for (const p of players) {
    const zone = tacticalZoneFromPosition({
      positionCode: p.positionCode,
      roleIcon: p.roleIcon,
      playerName: p.playerName,
      team: p.team,
      teamId: p.teamId
    });
    const entry = byZone.get(zone.id) ?? { label: zone.label, players: [] };
    entry.players.push(p);
    byZone.set(zone.id, entry);
  }

  const zones: PressureZoneSummary[] = [];
  for (const [zoneId, { label, players: zonePlayers }] of byZone) {
    const committed = zonePlayers
      .map((p) => p.foulsCommittedP90)
      .filter((n): n is number => n != null);
    const suffered = zonePlayers
      .map((p) => p.foulsSufferedP90)
      .filter((n): n is number => n != null);
    if (!committed.length && !suffered.length) continue;

    const avgCommitted = committed.length
      ? roundMetric(committed.reduce((a, b) => a + b, 0) / committed.length)
      : 0;
    const avgSuffered = suffered.length
      ? roundMetric(suffered.reduce((a, b) => a + b, 0) / suffered.length)
      : 0;
    const combined = avgCommitted + avgSuffered * 0.65;
    const { level } = intensityLevelFromScore(combined);

    let summary = "Zona con profilo di contatto nella norma.";
    if (avgSuffered >= 1.6 && avgCommitted >= 1.4) {
      summary = "Zona con elevata densità di contatti e contrasti.";
    } else if (avgSuffered >= 1.6) {
      summary = "Zona con giocatori molto esposti alla pressione avversaria.";
    } else if (avgCommitted >= 1.6) {
      summary = "Zona con diversi profili aggressivi nei contrasti.";
    } else if (avgSuffered >= 1.2) {
      summary = "Zona con esposizione ai contatti sopra la media del match.";
    }

    const topPlayers = [...zonePlayers]
      .sort(
        (a, b) =>
          (b.foulsCommittedP90 ?? 0) +
          (b.foulsSufferedP90 ?? 0) -
          ((a.foulsCommittedP90 ?? 0) + (a.foulsSufferedP90 ?? 0))
      )
      .slice(0, 3)
      .map((p) => p.playerName);

    zones.push({
      zoneId,
      zoneLabel: label,
      avgCommittedP90: avgCommitted,
      avgSufferedP90: avgSuffered,
      playerCount: zonePlayers.length,
      intensityLevel: level,
      summary,
      topPlayers
    });
  }

  return zones.sort(
    (a, b) => b.avgCommittedP90 + b.avgSufferedP90 - (a.avgCommittedP90 + a.avgSufferedP90)
  );
}

function buildRoleGroups(players: PlayerIntensityMetrics[]): RoleGroupSummary[] {
  const groups = new Map<string, PlayerIntensityMetrics[]>();
  for (const p of players) {
    const id = p.roleLabel;
    const list = groups.get(id) ?? [];
    list.push(p);
    groups.set(id, list);
  }

  const result: RoleGroupSummary[] = [];
  for (const [roleLabel, group] of groups) {
    if (group.length < 2 && roleLabel === "Portiere") continue;

    const topAggressive = [...group]
      .filter((p) => p.foulsCommittedP90 != null)
      .sort((a, b) => (b.foulsCommittedP90 ?? 0) - (a.foulsCommittedP90 ?? 0))
      .slice(0, 3);

    const topExposed = [...group]
      .filter((p) => p.foulsSufferedP90 != null)
      .sort((a, b) => (b.foulsSufferedP90 ?? 0) - (a.foulsSufferedP90 ?? 0))
      .slice(0, 3);

    const topDiff = [...group]
      .filter((p) => p.foulsDiffP90 != null)
      .sort((a, b) => Math.abs(b.foulsDiffP90 ?? 0) - Math.abs(a.foulsDiffP90 ?? 0))
      .slice(0, 3);

    if (!topAggressive.length && !topExposed.length) continue;

    result.push({
      roleGroup: roleLabel.toLowerCase().replace(/\s+/g, "_"),
      roleLabel,
      topAggressive,
      topExposed,
      topDiff
    });
  }

  return result;
}

function buildTechnicalSummary(params: {
  matchIntensity: MatchIntensityIndex;
  aggressive: PlayerIntensityMetrics[];
  exposed: PlayerIntensityMetrics[];
  zones: PressureZoneSummary[];
  reliability: DataReliabilityLevel;
}): string {
  const { matchIntensity, aggressive, exposed, zones, reliability } = params;
  const parts: string[] = [];

  if (matchIntensity.value != null) {
    parts.push(
      `La partita presenta un livello di intensità ${matchIntensity.label.toLowerCase().replace("intensità ", "")}.`
    );
  }

  const topAgg = aggressive[0];
  if (topAgg?.foulsCommittedP90 != null) {
    parts.push(
      `Tra i profili più aggressivi spicca ${topAgg.playerName} (${topAgg.team}) con ${formatMetric(topAgg.foulsCommittedP90)} falli commessi di media nel torneo.`
    );
  }

  const topExp = exposed[0];
  if (topExp?.foulsSufferedP90 != null) {
    parts.push(
      `${topExp.playerName} risulta tra i giocatori più esposti al contatto (${formatMetric(topExp.foulsSufferedP90)} falli subiti di media nel torneo).`
    );
  }

  const hotZone = zones[0];
  if (hotZone) {
    parts.push(`${hotZone.zoneLabel}: ${hotZone.summary.toLowerCase()}`);
  }

  if (reliability === "low" || reliability === "medium") {
    parts.push("Alcuni dati hanno affidabilità media per via del minutaggio o del campione ridotto.");
  }

  return parts.join(" ") || "Analisi tecnica non disponibile con i dati correnti.";
}

export function buildMatchIntensityAnalysis(
  metrics: IntensityPlayerInput[],
  options?: { homeTeamId?: number }
): MatchIntensityAnalysis {
  const playerMetrics = metrics.map(buildPlayerIntensityMetrics);

  const aggressivePlayers = [...playerMetrics]
    .filter(
      (p) => p.foulsCommittedP90 != null && p.foulsCommittedP90 > FOULS_PROFILE_MIN_AVG
    )
    .sort((a, b) => (b.foulsCommittedP90 ?? 0) - (a.foulsCommittedP90 ?? 0))
    .slice(0, 12);

  const exposedPlayers = [...playerMetrics]
    .filter((p) => p.foulsSufferedP90 != null && p.foulsSufferedP90 > FOULS_PROFILE_MIN_AVG)
    .sort((a, b) => (b.foulsSufferedP90 ?? 0) - (a.foulsSufferedP90 ?? 0))
    .slice(0, 12);

  const matchIntensity = computeMatchIntensityIndex(playerMetrics);
  const highIntensityDuels = buildHighIntensityDuels(metrics, options?.homeTeamId);
  const pressureZones = buildPressureZones(playerMetrics);
  const roleGroups = buildRoleGroups(playerMetrics);

  const lowSampleCount = playerMetrics.filter((p) => p.reliability === "low").length;
  const reliabilityLevels = playerMetrics.map((p) => p.reliability);
  const avgRel =
    reliabilityLevels.filter((r) => r === "high" || r === "good").length /
    Math.max(1, reliabilityLevels.length);
  const overviewLevel: DataReliabilityLevel =
    avgRel >= 0.55 ? "good" : avgRel >= 0.3 ? "medium" : "low";

  const trendAvailable = playerMetrics.some(
    (p) => p.trendCommitted !== "unavailable" || p.trendSuffered !== "unavailable"
  );

  return {
    matchIntensity,
    aggressivePlayers,
    exposedPlayers,
    highIntensityDuels,
    pressureZones,
    roleGroups,
    reliabilityOverview: {
      level: overviewLevel,
      note:
        overviewLevel === "good"
          ? "Buona affidabilità statistica sul campione analizzato."
          : overviewLevel === "medium"
            ? "Affidabilità media: confronta i profili tra pari ruolo."
            : "Campione limitato: lettura da interpretare con cautela.",
      lowSampleCount,
      totalPlayers: playerMetrics.length
    },
    technicalSummary: buildTechnicalSummary({
      matchIntensity,
      aggressive: aggressivePlayers,
      exposed: exposedPlayers,
      zones: pressureZones,
      reliability: overviewLevel
    }),
    trendAvailable
  };
}

export function mapIntensityLevelForPreview(level: IntensityLevel): "low" | "medium" | "high" {
  if (level === "very_high" || level === "high") return "high";
  if (level === "medium") return "medium";
  return "low";
}

/** Indice intensità partita per card home / lista partite (prima del dettaglio). */
export function computeMatchIntensityPreview(metrics: IntensityPlayerInput[]): {
  value: number | null;
  label: string;
  level: IntensityLevel;
  uiLevel: "low" | "medium" | "high";
} {
  const idx = computeMatchIntensityIndex(metrics.map(buildPlayerIntensityMetrics));
  return {
    value: idx.value,
    label: idx.label,
    level: idx.level,
    uiLevel: mapIntensityLevelForPreview(idx.level)
  };
}
