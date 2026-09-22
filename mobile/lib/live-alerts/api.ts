import { env } from "@/lib/env";
import { buildMobileHeaders } from "@/lib/mobile-http";
import type { LiveAlertRow, LiveAlertType, LiveHubDetail, LiveHubMatch, LiveStatisticName } from "@/lib/live-alerts/types";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchLiveHubMatches(): Promise<LiveHubMatch[]> {
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts/hub`, {
    headers: await buildMobileHeaders(false),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("live_hub_failed");
  const json = await readJson<{ matches?: LiveHubMatch[] }>(res);
  return Array.isArray(json.matches) ? json.matches : [];
}

export async function fetchLiveHubDetail(eventId: number): Promise<LiveHubDetail> {
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts/hub/${eventId}`, {
    headers: await buildMobileHeaders(false),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("live_detail_failed");
  return readJson<LiveHubDetail>(res);
}

export async function heartbeatLiveMatch(fixtureId: number): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts/hub`, {
    method: "POST",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify({ fixtureId })
  });
  if (!res.ok) throw new Error("live_heartbeat_failed");
}

export async function fetchMyLiveAlerts(fixtureId?: number): Promise<LiveAlertRow[]> {
  const qs = fixtureId ? `?fixtureId=${fixtureId}` : "";
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts${qs}`, {
    headers: await buildMobileHeaders(true),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("live_alerts_failed");
  const json = await readJson<{ alerts?: LiveAlertRow[] }>(res);
  return Array.isArray(json.alerts) ? json.alerts : [];
}

export async function createLiveAlert(body: {
  fixtureId: number;
  alertType: LiveAlertType;
  statisticName: LiveStatisticName;
  targetValue: number;
  teamId?: number | null;
  playerId?: number | null;
  subjectName?: string | null;
  locale?: "it" | "en";
}): Promise<LiveAlertRow> {
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts`, {
    method: "POST",
    headers: await buildMobileHeaders(true),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("live_alert_create_failed");
  const json = await readJson<{ alert: LiveAlertRow }>(res);
  return json.alert;
}

export async function cancelLiveAlert(alertId: string): Promise<void> {
  const res = await fetch(`${env.apiUrl}/api/mobile/live-alerts/${alertId}`, {
    method: "DELETE",
    headers: await buildMobileHeaders(true)
  });
  if (!res.ok) throw new Error("live_alert_cancel_failed");
}
