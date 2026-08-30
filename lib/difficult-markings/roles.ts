import type { TacticalMetrics } from "@/lib/types";
import type { PlayerRecentProfile, NormalizedRole } from "@/lib/difficult-markings/types";

export const GRID_COLUMNS = 8;
export const GRID_ROWS = 6;
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function roleSideFromCode(positionCode?: string): "left" | "center" | "right" {
  const s = (positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  if (!s) return "center";
  if (/^(DL|LWB|LB|ML|AML|LW|LM|WL)(\/|$)/.test(s)) return "left";
  if (/^(DR|RWB|RB|MR|AMR|RW|RM|WR)(\/|$)/.test(s)) return "right";
  const last = s[s.length - 1];
  const first = s[0];
  if (last === "L" && /^[DAMFW]/.test(first)) return "left";
  if (last === "R" && /^[DAMFW]/.test(first)) return "right";
  return "center";
}

/** Ricava il lato di campo dal ruolo normalizzato (fallback se manca il positionCode). */
export function formationSideFromNormalizedRole(role: NormalizedRole | string): "left" | "center" | "right" {
  const normalized = String(role).toUpperCase();
  if (normalized.includes("LEFT")) return "left";
  if (normalized.includes("RIGHT")) return "right";
  return "center";
}

export function resolveFormationSide(positionCode: string | undefined, role: NormalizedRole): "left" | "center" | "right" {
  const fromCode = roleSideFromCode(positionCode);
  if (fromCode !== "center") return fromCode;
  return formationSideFromNormalizedRole(role);
}

export function normalizeRoleFromMetrics(m: TacticalMetrics): NormalizedRole {
  if (m.roleIcon === "🧤") return "GK";

  const s = (m.positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  const side = roleSideFromCode(m.positionCode);

  if (!s || s === "G" || s.startsWith("GK")) return "GK";

  if (/^(DC|CB|SW|LIB)(\/|$)/.test(s) || s === "D") {
    if (side === "left") return "CB_LEFT";
    if (side === "right") return "CB_RIGHT";
    return "CB_CENTER";
  }

  if (/^(DL|LB)(\/|$)/.test(s)) return "FULLBACK_LEFT";
  if (/^(DR|RB)(\/|$)/.test(s)) return "FULLBACK_RIGHT";
  if (/^(LWB)(\/|$)/.test(s)) return "WINGBACK_LEFT";
  if (/^(RWB)(\/|$)/.test(s)) return "WINGBACK_RIGHT";

  if (/^(DM|CDM|MD)(\/|$)/.test(s)) return "DM";
  if (/^(AM|CAM|T)(\/|$)/.test(s)) return "AM";

  if (/^(ML|LM|CM_L)(\/|$)/.test(s)) return "CM_LEFT";
  if (/^(MR|RM|CM_R)(\/|$)/.test(s)) return "CM_RIGHT";
  if (/^(MC|CM|C)(\/|$)/.test(s) || s === "M" || s === "MF") return "CM_CENTER";

  if (/^(RW|WR|RAMF|RF)(\/|$)/.test(s)) return "WINGER_RIGHT";
  if (/^(LW|WL|LAMF|LF)(\/|$)/.test(s)) return "WINGER_LEFT";
  if (/^(SS|2A)(\/|$)/.test(s)) return "SECOND_STRIKER";
  if (/^(ST|CF|FW|SC|AF|P)(\/|$)/.test(s)) return "CENTER_FORWARD";

  if (m.roleIcon === "🛡️") {
    if (side === "left") return "FULLBACK_LEFT";
    if (side === "right") return "FULLBACK_RIGHT";
    return "CB_CENTER";
  }

  if (m.roleIcon === "🎯") {
    if (side === "left") return "WINGER_LEFT";
    if (side === "right") return "WINGER_RIGHT";
    return "CENTER_FORWARD";
  }

  if (m.roleIcon === "⚡") {
    if (side === "left") return "CM_LEFT";
    if (side === "right") return "CM_RIGHT";
    return "CM_CENTER";
  }

  return "UNKNOWN";
}

export function roleLabelIt(role: NormalizedRole): string {
  const map: Record<NormalizedRole, string> = {
    GK: "Portiere",
    CB_LEFT: "Centrale sinistro",
    CB_CENTER: "Centrale",
    CB_RIGHT: "Centrale destro",
    FULLBACK_LEFT: "Terzino sinistro",
    FULLBACK_RIGHT: "Terzino destro",
    WINGBACK_LEFT: "Esterno sinistro",
    WINGBACK_RIGHT: "Esterno destro",
    DM: "Mediano",
    CM_LEFT: "Centrocampista sinistro",
    CM_CENTER: "Centrocampista centrale",
    CM_RIGHT: "Centrocampista destro",
    AM: "Trequartista",
    WINGER_LEFT: "Ala sinistra",
    WINGER_RIGHT: "Ala destra",
    SECOND_STRIKER: "Seconda punta",
    CENTER_FORWARD: "Centravanti",
    UNKNOWN: "Ruolo non classificato"
  };
  return map[role] ?? role;
}

export type RolePercentileGroup =
  | "winger"
  | "striker"
  | "am"
  | "midfielder"
  | "fullback"
  | "wingback"
  | "center_back"
  | "other";

export function percentileGroupForRole(role: NormalizedRole): RolePercentileGroup {
  if (role === "WINGER_LEFT" || role === "WINGER_RIGHT") return "winger";
  if (role === "CENTER_FORWARD" || role === "SECOND_STRIKER") return "striker";
  if (role === "AM") return "am";
  if (role === "DM" || role === "CM_LEFT" || role === "CM_CENTER" || role === "CM_RIGHT") return "midfielder";
  if (role === "FULLBACK_LEFT" || role === "FULLBACK_RIGHT") return "fullback";
  if (role === "WINGBACK_LEFT" || role === "WINGBACK_RIGHT") return "wingback";
  if (role === "CB_LEFT" || role === "CB_CENTER" || role === "CB_RIGHT") return "center_back";
  return "other";
}

export function isAttackerRole(role: NormalizedRole): boolean {
  return (
    role === "WINGER_LEFT" ||
    role === "WINGER_RIGHT" ||
    role === "CENTER_FORWARD" ||
    role === "SECOND_STRIKER" ||
    role === "AM"
  );
}

export function isClassicMarkerRole(role: NormalizedRole): boolean {
  return (
    role === "CB_LEFT" ||
    role === "CB_CENTER" ||
    role === "CB_RIGHT" ||
    role === "FULLBACK_LEFT" ||
    role === "FULLBACK_RIGHT" ||
    role === "WINGBACK_LEFT" ||
    role === "WINGBACK_RIGHT" ||
    role === "DM"
  );
}

export function isDefenderRole(role: NormalizedRole): boolean {
  return isClassicMarkerRole(role) || isMidfieldMarkerRole(role);
}

export function isMidfieldMarkerRole(role: NormalizedRole): boolean {
  return role === "DM" || role === "CM_LEFT" || role === "CM_CENTER" || role === "CM_RIGHT";
}

/** Overlap heatmap minimo per considerare una marcatura reale (duello di ruolo classico). */
export const MARKING_HEATMAP_MIN_OVERLAP = 0.32;
/** Per un centrocampista che copre fuori dal duello di ruolo classico serve un po’ più di zona condivisa. */
const COVERING_MID_HEATMAP_MIN_OVERLAP = 0.36;
/** Soglia per contare un avversario nel carico 2+: heatmap allineate, non identiche. */
export const COVER_HEATMAP_MIN_OVERLAP_PCT = 24;
export const COVER_HEATMAP_MIN_OVERLAP = COVER_HEATMAP_MIN_OVERLAP_PCT / 100;

function hasUsableMarkingHeatmap(profile: PlayerRecentProfile): boolean {
  return (
    (profile.heatmapPointCount ?? 0) >= 3 ||
    (profile.heatmapPointsMatchFrame?.length ?? 0) >= 3 ||
    (profile.defensiveHeatmap?.some((v) => v > 0) ?? false)
  );
}

/** La massa heatmap è in trequarti, non in metà campo propria. */
export function heatmapOccupiesAttackingThird(
  profile: Pick<PlayerRecentProfile, "heatmapAttackShare" | "heatmapDefenseShare" | "averagePosition">
): boolean {
  const attack = profile.heatmapAttackShare ?? 0;
  const defense = profile.heatmapDefenseShare ?? 0;
  if (attack >= 0.42 && attack > defense + 0.08) return true;
  const y = profile.averagePosition?.y;
  return y != null && y >= 58 && attack >= defense;
}

/**
 * Marcatore di copertura: chi per ruolo deve coprire (difesa / mediano / mezzala di contrasto).
 * Punte, ali e trequartisti non sono mai il soggetto del card: sono gli avversari da marcare.
 */
export function profileActsAsDefender(profile: PlayerRecentProfile): boolean {
  if (profile.roleIcon === "🧤") return false;
  if (isAttackerRole(profile.normalizedRole)) return false;
  if (profile.roleIcon === "🎯") return false;

  if (isClassicMarkerRole(profile.normalizedRole) || profile.roleIcon === "🛡️") {
    return hasUsableMarkingHeatmap(profile);
  }

  if (profile.normalizedRole === "CM_LEFT" || profile.normalizedRole === "CM_CENTER" || profile.normalizedRole === "CM_RIGHT") {
    if (!hasUsableMarkingHeatmap(profile)) return false;
    if (heatmapOccupiesAttackingThird(profile)) return false;
    const committed = profile.foulsCommittedPer90 ?? 0;
    const drawn = profile.foulsDrawnPer90 ?? 0;
    return committed + 0.3 >= drawn;
  }

  return false;
}

const ROLE_COMPATIBILITY: Partial<Record<NormalizedRole, NormalizedRole[]>> = {
  WINGER_LEFT: [
    "FULLBACK_RIGHT",
    "WINGBACK_RIGHT",
    "CB_RIGHT",
    "CB_CENTER",
    "CM_RIGHT",
    "CM_CENTER",
    "DM"
  ],
  WINGER_RIGHT: [
    "FULLBACK_LEFT",
    "WINGBACK_LEFT",
    "CB_LEFT",
    "CB_CENTER",
    "CM_LEFT",
    "CM_CENTER",
    "DM"
  ],
  CENTER_FORWARD: [
    "CB_LEFT",
    "CB_CENTER",
    "CB_RIGHT",
    "DM",
    "CM_CENTER",
    "CM_LEFT",
    "CM_RIGHT",
    "FULLBACK_LEFT",
    "FULLBACK_RIGHT"
  ],
  SECOND_STRIKER: [
    "CB_LEFT",
    "CB_CENTER",
    "CB_RIGHT",
    "DM",
    "CM_CENTER",
    "CM_LEFT",
    "CM_RIGHT"
  ],
  AM: [
    "DM",
    "CM_CENTER",
    "CM_LEFT",
    "CM_RIGHT",
    "CB_CENTER",
    "CB_LEFT",
    "CB_RIGHT",
    "FULLBACK_LEFT",
    "FULLBACK_RIGHT"
  ],
  WINGBACK_LEFT: ["WINGER_RIGHT", "FULLBACK_RIGHT", "CM_RIGHT"],
  WINGBACK_RIGHT: ["WINGER_LEFT", "FULLBACK_LEFT", "CM_LEFT"]
};

export function roleCompatibilityScore(attackerRole: NormalizedRole, defenderRole: NormalizedRole): number {
  if (!attackerRole || !defenderRole) return 0;
  if (isAttackerRole(defenderRole) && !isAttackerRole(attackerRole)) {
    return roleCompatibilityScore(defenderRole, attackerRole);
  }
  if (isAttackerRole(defenderRole)) return 0;
  const allowed = ROLE_COMPATIBILITY[attackerRole];
  if (allowed?.includes(defenderRole)) return 1;
  if (isMidfieldMarkerRole(defenderRole) && isAttackerRole(attackerRole)) return 0.72;
  if (defenderRole.startsWith("CB_") && attackerRole === "CENTER_FORWARD") return 0.72;
  if (defenderRole === "DM" && attackerRole === "AM") return 0.68;
  if (!allowed?.length) return 0.35;
  return 0.18;
}

export function rolesAreCompatible(attackerRole: NormalizedRole, defenderRole: NormalizedRole): boolean {
  return roleCompatibilityScore(attackerRole, defenderRole) >= 0.55;
}

/**
 * Stessa zona di heatmap + ruoli che hanno senso come marcatura.
 * Chi marca è deciso dal ruolo; chi viene marcato è un attaccante la cui heatmap
 * si sovrappone a quella del marcatore. La matrice ruoli abbassa la soglia di overlap.
 */
export function markingPairAllowed(
  attackerRole: NormalizedRole,
  defenderRole: NormalizedRole,
  overlap: number
): boolean {
  if (overlap < MARKING_HEATMAP_MIN_OVERLAP) return false;
  if (isAttackerRole(defenderRole) || defenderRole === "GK") return false;
  if (!isDefenderRole(defenderRole)) return false;
  if (!isAttackerRole(attackerRole)) return false;

  if (rolesAreCompatible(attackerRole, defenderRole)) return true;

  /** Stessa zona: mezzala/mediano o difensore che copre 2–3 attaccanti sulla heatmap. */
  if (
    (isMidfieldMarkerRole(defenderRole) || isClassicMarkerRole(defenderRole)) &&
    overlap >= COVERING_MID_HEATMAP_MIN_OVERLAP
  ) {
    return true;
  }
  return false;
}

/** Avversario da marcare: ruoli offensivi (ali, trequartisti, punte) con falli subiti o dribbling. */
export function profileIsMarkingCoverTarget(profile: PlayerRecentProfile): boolean {
  if (profile.roleIcon === "🧤") return false;
  if (profile.normalizedRole === "GK" || profile.normalizedRole.startsWith("CB_")) return false;
  if (
    profile.normalizedRole === "FULLBACK_LEFT" ||
    profile.normalizedRole === "FULLBACK_RIGHT" ||
    profile.normalizedRole === "WINGBACK_LEFT" ||
    profile.normalizedRole === "WINGBACK_RIGHT"
  ) {
    return false;
  }
  const fouls = profile.foulsDrawnPer90 ?? 0;
  const dribbles = profile.dribblesSuccessfulPer90 ?? 0;
  if (fouls < 0.8 && dribbles < 1.0) return false;
  if (isAttackerRole(profile.normalizedRole) || profile.roleIcon === "🎯") return true;
  /**
   * Mezzala/trequartista classificata come MC: è un bersaglio solo se la heatmap
   * occupa la trequarti, non perché subisce falli (quello può essere un mediano).
   */
  if (isMidfieldMarkerRole(profile.normalizedRole) || profile.roleIcon === "⚡") {
    if (!heatmapOccupiesAttackingThird(profile)) return false;
    return dribbles >= 1.2 || fouls >= 0.8;
  }
  return false;
}

export function coverPairAllowed(
  attackerRole: NormalizedRole,
  defenderRole: NormalizedRole,
  overlap: number
): boolean {
  if (Math.round(overlap * 100) < COVER_HEATMAP_MIN_OVERLAP_PCT) return false;
  if (isAttackerRole(defenderRole) || defenderRole === "GK") return false;
  if (!isDefenderRole(defenderRole)) return false;
  if (attackerRole.startsWith("CB_") || attackerRole === "GK") return false;
  return true;
}

export function profileActsAsAttacker(profile: PlayerRecentProfile): boolean {
  if (profile.roleIcon === "🧤") return false;
  if (isAttackerRole(profile.normalizedRole)) return true;
  if (profile.roleIcon === "🎯") return true;
  const fouls = profile.foulsDrawnPer90 ?? 0;
  const dribbles = Math.max(
    profile.dribblesSuccessfulPer90 ?? 0,
    (profile.dribblesAttemptedPer90 ?? 0) * 0.5
  );
  /** Centrocampisti/esterne con profilo da marcare (falli subiti + dribbling). */
  if (fouls >= 0.95 && dribbles >= 0.95 && !profile.normalizedRole.startsWith("CB_")) {
    return true;
  }
  if (
    profile.roleIcon === "⚡" &&
    profile.formationSide !== "center" &&
    (profile.foulsDrawnPer90 ?? 0) >= 0.9
  ) {
    return true;
  }
  return false;
}
