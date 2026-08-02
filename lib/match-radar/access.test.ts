import assert from "node:assert/strict";
import { isMatchRadarProAccess } from "@/lib/match-radar/access";
import type { ApiAccessContext } from "@/lib/auth/resolve-api-access";

function ctx(partial: Partial<ApiAccessContext>): ApiAccessContext {
  return {
    mode: "authenticated",
    organizationId: "org",
    userId: "user",
    role: "member",
    supabase: {} as ApiAccessContext["supabase"],
    ...partial
  };
}

assert.equal(isMatchRadarProAccess(ctx({ role: "member" })), false);
assert.equal(isMatchRadarProAccess(ctx({ role: "member" }), "free"), false);
assert.equal(isMatchRadarProAccess(ctx({ role: "member" }), "pro"), true);
assert.equal(isMatchRadarProAccess(ctx({ role: "pro" }), "free"), true);
assert.equal(isMatchRadarProAccess(ctx({ role: "admin" })), true);
assert.equal(isMatchRadarProAccess(ctx({ mode: "guest", role: "guest", userId: null })), false);

console.log("match-radar access ok");
