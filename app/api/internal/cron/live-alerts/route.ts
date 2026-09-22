import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/data-refresh/cron-auth";
import { runLiveAlertsTick } from "@/lib/live-alerts/live-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const tick = await runLiveAlertsTick();
    return NextResponse.json({ trigger: "live_alerts", ...tick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "live_alerts_failed";
    console.error("[cron/live-alerts]", error);
    return NextResponse.json({ error: message, ok: false }, { status: 503 });
  }
}
