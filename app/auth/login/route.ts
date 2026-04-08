import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/display");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  const redirectUrl = new URL(
    error ? `/login?error=1&next=${encodeURIComponent(nextPath)}` : nextPath,
    request.url
  );

  return NextResponse.redirect(redirectUrl);
}
