import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/get-api-user";
import { NO_STORE_HEADERS } from "@/lib/http/no-store-headers";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  expoPushToken: z.string().trim().min(20).max(200),
  platform: z.enum(["ios", "android"]).optional(),
  locale: z.enum(["it", "en"]).optional()
});

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const token = parsed.data.expoPushToken;
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("user_push_tokens").upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      platform: parsed.data.platform ?? null,
      locale: parsed.data.locale ?? "it",
      updated_at: new Date().toISOString()
    },
    { onConflict: "expo_push_token" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const parsed = bodySchema.pick({ expoPushToken: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("user_push_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("expo_push_token", parsed.data.expoPushToken);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
