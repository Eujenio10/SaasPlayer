/**
 * Visibilità Marcature difficili.
 *
 * Default: visibili a tutti (Free incluso). Per nasconderle di nuovo ai non-admin:
 * `PITCHBRAIN_DIFFICULT_MARKINGS_ADMIN_ONLY=1` su Vercel e nuova build app.
 */

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw == null || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export const DIFFICULT_MARKINGS_ADMIN_ONLY = envBool(
  "PITCHBRAIN_DIFFICULT_MARKINGS_ADMIN_ONLY",
  false
);

export function canViewDifficultMarkings(access?: {
  isAdmin?: boolean | null;
  role?: string | null;
} | null): boolean {
  if (!DIFFICULT_MARKINGS_ADMIN_ONLY) return true;
  if (access?.isAdmin) return true;
  return access?.role === "admin";
}
