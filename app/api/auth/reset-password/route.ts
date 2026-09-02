import { NextResponse } from "next/server";
import { sendLocalizedPasswordResetEmail } from "@/lib/auth/signup-invite";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; locale?: string } | null;
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const result = await sendLocalizedPasswordResetEmail(service, email, body?.locale);

  if (!result.ok) {
    const status = result.error === "rate_limit" ? 429 : 500;
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, message: result.message },
    { headers: { "Cache-Control": "no-store" } }
  );
}
