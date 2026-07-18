import { NextResponse } from "next/server";
import { createApiSupabaseClient, getApiUser } from "@/lib/auth/get-api-user";

export async function PATCH(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = (await request.json().catch(() => null)) as { fullName?: unknown } | null;
  const raw = typeof json?.fullName === "string" ? json.fullName.trim() : "";
  if (raw.length < 2 || raw.length > 120) {
    return NextResponse.json({ error: "invalid_full_name" }, { status: 400 });
  }

  const supabase = createApiSupabaseClient(request);
  const { error } = await supabase.auth.updateUser({
    data: { full_name: raw }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, fullName: raw });
}
