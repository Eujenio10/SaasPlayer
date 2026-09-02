import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  normalizeAuthEmailLocale,
  sendAuthEmail,
  type AuthEmailKind
} from "@/lib/email/send-signup-email";

export const dynamic = "force-dynamic";

type HookPayload = {
  user?: { email?: string; user_metadata?: { locale?: string } };
  email_data?: {
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

function hookAuthorized(request: Request): boolean {
  const secret = env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function kindFromAction(action: string | undefined): AuthEmailKind | null {
  if (action === "recovery") return "recovery";
  if (action === "invite" || action === "signup" || action === "magiclink") return "signup";
  return null;
}

export async function POST(request: Request) {
  if (!hookAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as HookPayload | null;
  const email = body?.user?.email?.trim().toLowerCase();
  const action = body?.email_data?.email_action_type;
  const kind = kindFromAction(action);
  const tokenHash = body?.email_data?.token_hash;
  const redirectTo = body?.email_data?.redirect_to ?? "";
  if (!email || !kind || !tokenHash) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const verifyBase = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const actionLink = `${verifyBase}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(action ?? "signup")}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const locale = normalizeAuthEmailLocale(body?.user?.user_metadata?.locale);
  const sent = await sendAuthEmail({ to: email, actionLink, kind, locale });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error, message: sent.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
