import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("org_id");
  response.cookies.delete("org_name");
  return response;
}
