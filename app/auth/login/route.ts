import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseResponseClient } from "@/lib/supabase/server";

/** Evita open-redirect: solo path relativi interni. */
function safeNextPath(raw: string, fallback: string): string {
  const s = (raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return fallback;
  return s;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(String(formData.get("next") ?? ""), "/");

  const destination = new URL(nextPath, request.url);
  const response = NextResponse.redirect(destination, 303);
  const supabase = createSupabaseResponseClient(response, request);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const errUrl = new URL("/login", request.url);
    errUrl.searchParams.set("error", "1");
    errUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(errUrl, 303);
  }

  return response;
}
