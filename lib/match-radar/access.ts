import type { ApiAccessContext } from "@/lib/auth/resolve-api-access";

/** Pro, admin e member autenticati vedono Match Radar completo (feature già protetta a livello prodotto). */
export function isMatchRadarProAccess(ctx: ApiAccessContext): boolean {
  if (ctx.role === "admin" || ctx.role === "pro") return true;
  if (ctx.mode === "authenticated" && ctx.role === "member") return true;
  return false;
}
