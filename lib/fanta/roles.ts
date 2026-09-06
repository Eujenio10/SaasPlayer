import type { NormalizedRole } from "@/lib/difficult-markings/types";
import type { FantaRoleGroup } from "@/lib/fanta/types";

const DEFENDER_ROLES = new Set<NormalizedRole>([
  "CB_LEFT",
  "CB_CENTER",
  "CB_RIGHT",
  "FULLBACK_LEFT",
  "FULLBACK_RIGHT",
  "WINGBACK_LEFT",
  "WINGBACK_RIGHT"
]);

const MID_ROLES = new Set<NormalizedRole>(["DM", "CM_LEFT", "CM_CENTER", "CM_RIGHT", "AM"]);

const FORWARD_ROLES = new Set<NormalizedRole>([
  "WINGER_LEFT",
  "WINGER_RIGHT",
  "SECOND_STRIKER",
  "CENTER_FORWARD"
]);

export function toFantaRoleGroup(
  role: string | null | undefined,
  rawPosition?: string | null
): FantaRoleGroup {
  const normalized = (role ?? "").toUpperCase() as NormalizedRole;
  if (normalized === "GK") return "goalkeeper";
  if (DEFENDER_ROLES.has(normalized)) return "defender";
  if (MID_ROLES.has(normalized)) return "midfielder";
  if (FORWARD_ROLES.has(normalized)) return "forward";

  const raw = (rawPosition ?? "").toLowerCase();
  if (/\b(gk|goalkeeper|portiere)\b/.test(raw)) return "goalkeeper";
  if (/\b(cb|lb|rb|wb|defender|back|difensore)\b/.test(raw)) return "defender";
  if (/\b(cm|dm|am|midfielder|centrocamp)\b/.test(raw)) return "midfielder";
  if (/\b(fw|st|cf|lw|rw|winger|attaccante|forward)\b/.test(raw)) return "forward";
  return "midfielder";
}

export function fantaRoleLabelIt(role: FantaRoleGroup): string {
  return fantaRoleLabel(role, "it");
}

export function fantaRoleLabel(role: FantaRoleGroup, locale: "it" | "en" = "it"): string {
  if (locale === "en") {
    if (role === "goalkeeper") return "Goalkeeper";
    if (role === "defender") return "Defender";
    if (role === "midfielder") return "Midfielder";
    return "Forward";
  }
  if (role === "goalkeeper") return "Portiere";
  if (role === "defender") return "Difensore";
  if (role === "midfielder") return "Centrocampista";
  return "Attaccante";
}
