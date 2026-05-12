import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseResponseClient } from "@/lib/supabase/server";

function safeRedirectTarget(next: string | null): string {
  const raw = (next ?? "").trim();
  if (!raw) return "/set-password";
  if (!raw.startsWith("/")) return "/set-password";
  if (raw.startsWith("//")) return "/set-password";
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type");
  const next = safeRedirectTarget(url.searchParams.get("next"));

  // PKCE: i cookie di sessione devono finire sulla stessa Response del redirect.
  if (code) {
    const destination = new URL(next, url);
    const response = NextResponse.redirect(destination);
    const supabase = createSupabaseResponseClient(response, request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
    }
    return response;
  }

  if (tokenHash && type) {
    const destination = new URL(next, url);
    const response = NextResponse.redirect(destination);
    const supabase = createSupabaseResponseClient(response, request);
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change",
      token_hash: tokenHash
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
    }
    return response;
  }

  return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
}
