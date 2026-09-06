import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiSupabaseClient, getApiUser } from "@/lib/auth/get-api-user";
import { MAX_FAVORITE_TEAMS } from "@/lib/notifications/favorite-teams-limit";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";

export const dynamic = "force-dynamic";

const teamSchema = z.object({
  teamId: z.number().int().positive(),
  teamName: z.string().trim().min(1).max(80).optional(),
  competitionId: z.string().trim().max(80).nullable().optional()
});

const putSchema = z.object({
  teams: z.array(teamSchema).max(MAX_FAVORITE_TEAMS)
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const supabase = createApiSupabaseClient(request);
  const [{ data: teams }, { data: prefs }] = await Promise.all([
    supabase
      .from("user_followed_teams")
      .select("team_id, team_name, competition_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("notification_preferences")
      .select("match_preview_enabled, matchup_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  return NextResponse.json(
    {
      teams: (teams ?? []).map((row) => ({
        teamId: Number(row.team_id),
        teamName: row.team_name ?? "",
        competitionId: row.competition_id ?? null
      })),
      preferences: {
        matchPreviewEnabled: prefs?.match_preview_enabled !== false,
        matchupEnabled: prefs?.matchup_enabled !== false
      }
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function PUT(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const supabase = createApiSupabaseClient(request);
  const unique = new Map<number, { teamId: number; teamName?: string; competitionId?: string | null }>();
  for (const team of parsed.data.teams) unique.set(team.teamId, team);
  const next = [...unique.values()].slice(0, MAX_FAVORITE_TEAMS);

  const { error: delError } = await supabase.from("user_followed_teams").delete().eq("user_id", user.id);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (next.length) {
    const { error: insError } = await supabase.from("user_followed_teams").insert(
      next.map((team) => ({
        user_id: user.id,
        team_id: team.teamId,
        team_name: team.teamName ?? null,
        competition_id: team.competitionId ?? null
      }))
    );
    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 400, headers: NO_STORE_HEADERS });
    }
  }
  await supabase.from("notification_preferences").upsert({
    user_id: user.id,
    match_preview_enabled: true,
    matchup_enabled: true,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id", ignoreDuplicates: true });

  return NextResponse.json({ ok: true, count: next.length }, { headers: NO_STORE_HEADERS });
}
