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
  if (/^(MC|CM|C)(\/|$)/.test(s)) return "CM_CENTER";

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

export function isDefenderRole(role: NormalizedRole): boolean {
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

const ROLE_COMPATIBILITY: Partial<Record<NormalizedRole, NormalizedRole[]>> = {
  WINGER_LEFT: ["FULLBACK_RIGHT", "WINGBACK_RIGHT", "CB_RIGHT"],
  WINGER_RIGHT: ["FULLBACK_LEFT", "WINGBACK_LEFT", "CB_LEFT"],
  CENTER_FORWARD: ["CB_LEFT", "CB_CENTER", "CB_RIGHT"],
  SECOND_STRIKER: ["CB_LEFT", "CB_CENTER", "CB_RIGHT", "DM"],
  AM: ["DM", "CM_CENTER", "CB_CENTER"],
  WINGBACK_LEFT: ["WINGER_RIGHT", "FULLBACK_RIGHT", "CM_RIGHT"],
  WINGBACK_RIGHT: ["WINGER_LEFT", "FULLBACK_LEFT", "CM_LEFT"]
};

export function roleCompatibilityScore(attackerRole: NormalizedRole, defenderRole: NormalizedRole): number {
  const allowed = ROLE_COMPATIBILITY[attackerRole];
  if (!allowed?.length) return 0.35;
  if (allowed.includes(defenderRole)) return 1;
  if (defenderRole.startsWith("CB_") && attackerRole === "CENTER_FORWARD") return 0.72;
  if (defenderRole === "DM" && attackerRole === "AM") return 0.68;
  return 0.18;
}

export function rolesAreCompatible(attackerRole: NormalizedRole, defenderRole: NormalizedRole): boolean {
  return roleCompatibilityScore(attackerRole, defenderRole) >= 0.55;
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
  if (!isDefenderRole(profile.normalizedRole) && fouls >= 0.95 && dribbles >= 0.95) {
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

export function profileActsAsDefender(profile: PlayerRecentProfile): boolean {
  if (profile.roleIcon === "🧤") return false;
  if (isDefenderRole(profile.normalizedRole)) return true;
  if (profile.roleIcon === "🛡️") return true;
  return false;
}
