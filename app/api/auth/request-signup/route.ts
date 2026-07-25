import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function signupRedirectTo(): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${appUrl}/auth/confirm?next=${encodeURIComponent("/set-password")}`;
}

/**
 * Registrazione mobile/web: invia email di invito Supabase.
 * L'utente sceglie la password sulla pagina /set-password dopo il link in email.
 * Usa admin.inviteUserByEmail (funziona anche se "Allow signups" è disabilitato).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const redirectTo = signupRedirectTo();

  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists") ||
      error.status === 422
    ) {
      return NextResponse.json(
        {
          ok: true,
          alreadyRegistered: true,
          message: "Questa email è già registrata. Accedi con la password oppure usa Recupera password."
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "invite_failed", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      alreadyRegistered: false,
      message:
        "Ti abbiamo inviato un'email. Apri il link per confermare e scegliere la password, poi torna sull'app e accedi."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
