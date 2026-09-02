export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveApiAccessContext } from "@/lib/auth/resolve-api-access";
import {
  getIntensityPreviewsForEventIds,
  intensityPreviewsToRecord
} from "@/lib/match-intensity-preview";

function parseEventIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  const ids = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isFinite(n) || n <= 0) continue;
    ids.add(Math.trunc(n));
    if (ids.size >= 120) break;
  }
  return [...ids];
}

export async function GET(request: Request) {
  const ctx = await resolveApiAccessContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "public_access_unavailable" }, { status: 503 });
  }

  const eventIds = parseEventIds(new URL(request.url).searchParams.get("eventIds"));
  if (!eventIds.length) {
    return NextResponse.json({ previews: {} });
  }

  const previewByEvent = await getIntensityPreviewsForEventIds(ctx.organizationId, eventIds);
  return NextResponse.json({
    previews: intensityPreviewsToRecord(previewByEvent)
  });
}
