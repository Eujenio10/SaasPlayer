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

function inferOtpType(
  type: string | null,
  next: string
): "signup" | "invite" | "magiclink" | "recovery" | "email_change" {
  if (type === "signup" || type === "invite" || type === "magiclink" || type === "recovery" || type === "email_change") {
    return type;
  }
  if (next === "/set-password") return "recovery";
  return "signup";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const typeParam = url.searchParams.get("type");
  const next = safeRedirectTarget(url.searchParams.get("next"));
  const otpType = inferOtpType(typeParam, next);

  if (code) {
    const destination = new URL(next, url.origin);
    const response = NextResponse.redirect(destination);
    const supabase = createSupabaseResponseClient(response, request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/confirm] exchangeCode failed", error.message);
      return NextResponse.redirect(
        new URL(
          `/auth/callback?error=exchange_failed&next=${encodeURIComponent(next)}`,
          url.origin
        )
      );
    }
    return response;
  }

  if (tokenHash) {
    const destination = new URL(next, url.origin);
    const response = NextResponse.redirect(destination);
    const supabase = createSupabaseResponseClient(response, request);
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash
    });
    if (error) {
      console.error("[auth/confirm] verifyOtp failed", otpType, error.message);
      return NextResponse.redirect(
        new URL(
          `/auth/callback?error=verify_failed&next=${encodeURIComponent(next)}`,
          url.origin
        )
      );
    }
    return response;
  }

  return NextResponse.redirect(
    new URL(`/auth/callback?error=missing_token&next=${encodeURIComponent(next)}`, url.origin)
  );
}
