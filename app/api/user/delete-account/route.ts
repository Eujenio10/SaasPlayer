import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/get-api-user";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

/**
 * Eliminazione definitiva account (requisito App Store).
 * Cancella l'utente Auth: le FK on delete cascade rimuovono i dati collegati.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") {
    return NextResponse.json(
      { error: "confirmation_required", hint: 'Invia { "confirm": "DELETE" }' },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
