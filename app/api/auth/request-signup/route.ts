import { NextResponse } from "next/server";
import { sendSignupOrResendEmail } from "@/lib/auth/signup-invite";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/**
 * Registrazione / reinvio email PitchBrain.
 * Se l'utente esiste ma non ha completato la registrazione, reinvia il link (recovery → set-password).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const result = await sendSignupOrResendEmail(service, email);

  if (!result.ok) {
    const status = result.error === "rate_limit" ? 429 : 500;
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (result.alreadyRegistered) {
    return NextResponse.json(
      {
        ok: true,
        alreadyRegistered: true,
        message: result.message
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      alreadyRegistered: false,
      resent: result.resent,
      message: result.message
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
