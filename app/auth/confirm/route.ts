import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeRedirectTarget(next: string | null): string {
  const raw = (next ?? "").trim();
  if (!raw) return "/set-password";
  if (!raw.startsWith("/")) return "/set-password";
  if (raw.startsWith("//")) return "/set-password";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type");
  const next = safeRedirectTarget(url.searchParams.get("next"));

  const supabase = createSupabaseServerClient();

  // Newer Supabase links (PKCE) provide `code`
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
    }
    return NextResponse.redirect(new URL(next, url));
  }

  // Older verify links provide token_hash + type (invite / recovery / magiclink etc.)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change",
      token_hash: tokenHash
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
    }
    return NextResponse.redirect(new URL(next, url));
  }

  return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url));
}

