import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { DisplayProgramPayload } from "@/lib/types";

/**
 * Lettura SSR / server-only (service role) del programma vetrina salvato dagli admin.
 */
export async function loadDisplayProgramSnapshotForOrganization(
  organizationId: string
): Promise<DisplayProgramPayload | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("organization_display_program_snapshot")
    .select("payload")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data?.payload || typeof data.payload !== "object") {
    return null;
  }

  const raw = data.payload as Record<string, unknown>;
  if (!Array.isArray(raw.slides)) {
    return null;
  }

  return data.payload as DisplayProgramPayload;
}

export function organizationDbEmptyDisplayProgram(nowIso: string): DisplayProgramPayload {
  return {
    slides: [],
    updatedAt: nowIso,
    sourceStatus: "organization_db_empty",
    programContext: undefined
  };
}
