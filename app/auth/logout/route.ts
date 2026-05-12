import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseResponseClient } from "@/lib/supabase/server";

/**
 * I link «Esci» usano <Link href="/auth/logout"> → navigazione GET.
 * Session/cookie Supabase sulla stessa Response del redirect (coerente col login).
 */
async function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  const supabase = createSupabaseResponseClient(response, request);
  await supabase.auth.signOut();

  /* Allineati a middleware.ts (stesso path, httpOnly). */
  const clear: Parameters<typeof response.cookies.set>[2] = {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  };
  response.cookies.set("org_id", "", clear);
  response.cookies.set("org_name", "", clear);
  response.cookies.set("access_role", "", clear);

  return response;
}

export async function GET(request: NextRequest) {
  return logout(request);
}

export async function POST(request: NextRequest) {
  return logout(request);
}
