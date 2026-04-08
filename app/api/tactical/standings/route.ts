import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSubscriptionContextForOrganization } from "@/lib/auth/subscription";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { env } from "@/lib/env";

const querySchema = z.object({
  tournamentId: z.coerce.number().int().min(1),
  seasonId: z.coerce.number().int().min(1),
  mode: z.enum(["total", "home", "away"]).optional()
});

type StandingsRow = {
  position: number;
  teamId: number;
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

function coerceNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseStandingsRows(payload: unknown): StandingsRow[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const standings = root.standings;
  if (!Array.isArray(standings) || standings.length === 0) return [];
  const first = standings[0] as Record<string, unknown>;
  const rows = first.rows;
  if (!Array.isArray(rows)) return [];

  const out: StandingsRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const team = (row.team && typeof row.team === "object" ? (row.team as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
    out.push({
      position: Math.max(0, Math.round(coerceNum(row.position))),
      teamId: Math.max(0, Math.round(coerceNum(team.id ?? row.teamId))),
      teamName: String(team.name ?? row.teamName ?? "").trim() || "TEAM",
      matches: Math.max(0, Math.round(coerceNum(row.matches))),
      wins: Math.max(0, Math.round(coerceNum(row.wins))),
      draws: Math.max(0, Math.round(coerceNum(row.draws))),
      losses: Math.max(0, Math.round(coerceNum(row.losses))),
      goalsFor: Math.max(0, Math.round(coerceNum(row.scoresFor ?? row.goalsFor))),
      goalsAgainst: Math.max(0, Math.round(coerceNum(row.scoresAgainst ?? row.goalsAgainst))),
      points: Math.max(0, Math.round(coerceNum(row.points)))
    });
  }

  return out.filter((r) => r.teamId > 0).sort((a, b) => a.position - b.position);
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subscription = await getSubscriptionContextForOrganization(organization.organizationId);
  if (organization.role !== "admin" && !subscription?.isOperational) {
    return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    tournamentId: url.searchParams.get("tournamentId"),
    seasonId: url.searchParams.get("seasonId"),
    mode: url.searchParams.get("mode") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_params", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tournamentId, seasonId, mode } = parsed.data;
  const safeMode = mode ?? "total";
  const ttlHours = Number(process.env.TACTICAL_STANDINGS_CACHE_HOURS ?? "6");
  const cacheKey = `tactical_standings:v1:${tournamentId}:${seasonId}:${safeMode}`;

  const cached = await getApiCache<{ rows: StandingsRow[]; updatedAt: string }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch(
      `https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/standings/${safeMode}`,
      {
        headers: {
          "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
          "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
        },
        next: { revalidate: 300 }
      }
    );
    if (!res.ok) {
      const status = res.status === 429 ? 429 : 503;
      return NextResponse.json({ error: "standings_unavailable" }, { status });
    }
    const json = (await res.json()) as unknown;
    const rows = parseStandingsRows(json);
    const payload = { rows, updatedAt: new Date().toISOString() };
    await setApiCache(cacheKey, payload, ttlHours);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "standings_unavailable";
    const status = message.includes("quota_exceeded") || message.includes("429") ? 429 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}

