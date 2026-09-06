import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiSupabaseClient, getApiUser } from "@/lib/auth/get-api-user";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  matchPreviewEnabled: z.boolean().optional(),
  matchupEnabled: z.boolean().optional()
});

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const supabase = createApiSupabaseClient(request);
  const { data } = await supabase
    .from("notification_preferences")
    .select("match_preview_enabled, matchup_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json(
    {
      matchPreviewEnabled: data?.match_preview_enabled !== false,
      matchupEnabled: data?.matchup_enabled !== false
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function PATCH(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const supabase = createApiSupabaseClient(request);
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("match_preview_enabled, matchup_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  const next = {
    user_id: user.id,
    match_preview_enabled: parsed.data.matchPreviewEnabled ?? existing?.match_preview_enabled ?? true,
    matchup_enabled: parsed.data.matchupEnabled ?? existing?.matchup_enabled ?? true,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("notification_preferences").upsert(next, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json(
    {
      matchPreviewEnabled: next.match_preview_enabled,
      matchupEnabled: next.matchup_enabled
    },
    { headers: NO_STORE_HEADERS }
  );
}
