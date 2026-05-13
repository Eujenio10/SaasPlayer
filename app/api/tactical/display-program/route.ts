import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationContextForUser } from "@/lib/auth/organization";
import { getSerieADisplayProgram } from "@/lib/serie-a-display-program";
import type { DisplayProgramPayload } from "@/lib/types";

async function persistOrgDisplayProgram(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  organizationId: string,
  program: DisplayProgramPayload
): Promise<void> {
  await supabase.from("organization_display_program_snapshot").upsert(
    {
      organization_id: organizationId,
      payload: program as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refreshRequested = url.searchParams.get("refresh") === "1";

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const organization = await getOrganizationContextForUser(user.id);
  if (!organization) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  /** Pro/Member ignorano sempre `refresh=1` sul client — niente build SportAPI/RapidAPI. */
  const forceRefresh = organization.role === "admin" && refreshRequested;

  if (organization.role !== "admin") {
    const { data: row, error } = await supabase
      .from("organization_display_program_snapshot")
      .select("payload")
      .eq("organization_id", organization.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "read_failed" }, { status: 500 });
    }

    if (!row?.payload || typeof row.payload !== "object") {
      const empty: DisplayProgramPayload = {
        slides: [],
        updatedAt: new Date().toISOString(),
        sourceStatus: "organization_db_empty",
        programContext: undefined
      };
      return NextResponse.json(empty);
    }

    const program = row.payload as DisplayProgramPayload;
    return NextResponse.json({
      ...program,
      displayProgramSource: "organization_db"
    });
  }

  try {
    const program = await getSerieADisplayProgram(forceRefresh);
    if (program.slides.length > 0) {
      await persistOrgDisplayProgram(supabase, organization.organizationId, program);
    }
    return NextResponse.json({
      ...program,
      displayProgramSource: "provider_or_cache"
    });
  } catch {
    return NextResponse.json(
      { slides: [], updatedAt: new Date().toISOString(), sourceStatus: "error" as const },
      { status: 500 }
    );
  }
}
