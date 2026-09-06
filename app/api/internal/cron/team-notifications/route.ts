import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/data-refresh/cron-auth";
import { runTeamNotificationsTick } from "@/lib/notifications/run-team-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const tick = await runTeamNotificationsTick();
    return NextResponse.json({ trigger: "team_notifications", ...tick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "team_notifications_failed";
    console.error("[cron/team-notifications]", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
