import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type {
  ActiveLiveMatchRow,
  LiveMatchSnapshot,
  LivePlayerStats,
  LiveTeamStats,
  MatchAlertRow,
  LiveAlertLocale,
  LiveAlertStatus,
  LiveAlertType,
  LiveStatisticName
} from "@/lib/live-alerts/types";

const VIEWER_TTL_MS = 90_000;

function sb() {
  return createSupabaseServiceClient();
}

function toAlert(row: Record<string, unknown>): MatchAlertRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fixtureId: Number(row.fixture_id),
    alertType: row.alert_type === "player" ? "player" : "team",
    teamId: row.team_id != null ? Number(row.team_id) : null,
    playerId: row.player_id != null ? Number(row.player_id) : null,
    statisticName: String(row.statistic_name) as LiveStatisticName,
    targetValue: Number(row.target_value),
    currentValue: Number(row.current_value),
    status: String(row.status) as LiveAlertStatus,
    subjectName: typeof row.subject_name === "string" ? row.subject_name : null,
    locale: row.locale === "en" ? "en" : "it",
    createdAt: String(row.created_at ?? "")
  };
}

export async function listActiveMatches(): Promise<ActiveLiveMatchRow[]> {
  const { data, error } = await sb().from("active_live_matches").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    fixtureId: Number(row.fixture_id),
    hasTeamAlert: Boolean(row.has_team_alert),
    hasPlayerAlert: Boolean(row.has_player_alert),
    activeViewers: Number(row.active_viewers ?? 0),
    priority: Number(row.priority ?? 1),
    lastUpdate: row.last_update ? String(row.last_update) : null,
    lastDetailsAt: row.last_details_at ? String(row.last_details_at) : null,
    lastTeamStatsAt: row.last_team_stats_at ? String(row.last_team_stats_at) : null,
    lastPlayerStatsAt: row.last_player_stats_at ? String(row.last_player_stats_at) : null
  }));
}

export async function listActiveAlerts(fixtureId?: number): Promise<MatchAlertRow[]> {
  let query = sb().from("match_alerts").select("*").eq("status", "ACTIVE");
  if (fixtureId) query = query.eq("fixture_id", fixtureId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toAlert(row as Record<string, unknown>));
}

export async function listUserAlerts(userId: string, fixtureId?: number): Promise<MatchAlertRow[]> {
  let query = sb().from("match_alerts").select("*").eq("user_id", userId).in("status", ["ACTIVE"]);
  if (fixtureId) query = query.eq("fixture_id", fixtureId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toAlert(row as Record<string, unknown>));
}

export async function insertAlert(params: {
  userId: string;
  fixtureId: number;
  alertType: LiveAlertType;
  teamId?: number | null;
  playerId?: number | null;
  statisticName: LiveStatisticName;
  targetValue: number;
  subjectName?: string | null;
  locale?: LiveAlertLocale;
}): Promise<MatchAlertRow> {
  const { data, error } = await sb()
    .from("match_alerts")
    .insert({
      user_id: params.userId,
      fixture_id: params.fixtureId,
      alert_type: params.alertType,
      team_id: params.teamId ?? null,
      player_id: params.playerId ?? null,
      statistic_name: params.statisticName,
      target_value: params.targetValue,
      current_value: 0,
      status: "ACTIVE",
      subject_name: params.subjectName ?? null,
      locale: params.locale === "en" ? "en" : "it"
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert_alert_failed");
  return toAlert(data as Record<string, unknown>);
}

export async function updateAlertProgress(
  id: string,
  currentValue: number,
  status: LiveAlertStatus
): Promise<void> {
  const { error } = await sb()
    .from("match_alerts")
    .update({ current_value: currentValue, status })
    .eq("id", id)
    .eq("status", "ACTIVE");
  if (error) throw new Error(error.message);
}

export async function cancelAlert(userId: string, alertId: string): Promise<number | null> {
  const { data, error } = await sb()
    .from("match_alerts")
    .update({ status: "CANCELLED" })
    .eq("id", alertId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .select("id, fixture_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? Number(data.fixture_id) : null;
}

export async function upsertMatchCache(snapshot: LiveMatchSnapshot): Promise<void> {
  const { error } = await sb().from("live_match_cache").upsert(
    {
      fixture_id: snapshot.fixtureId,
      home_score: snapshot.homeScore,
      away_score: snapshot.awayScore,
      status: snapshot.status,
      minute: snapshot.minute,
      home_team_id: snapshot.homeTeamId,
      away_team_id: snapshot.awayTeamId,
      home_team_name: snapshot.homeTeamName,
      away_team_name: snapshot.awayTeamName,
      updated_at: new Date().toISOString()
    },
    { onConflict: "fixture_id" }
  );
  if (error) throw new Error(error.message);
}

export async function readMatchCache(fixtureId: number): Promise<LiveMatchSnapshot | null> {
  const { data, error } = await sb()
    .from("live_match_cache")
    .select("*")
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const status = String(data.status ?? "");
  return {
    fixtureId,
    homeScore: Number(data.home_score ?? 0),
    awayScore: Number(data.away_score ?? 0),
    status,
    minute: data.minute == null ? null : Number(data.minute),
    homeTeamId: data.home_team_id == null ? null : Number(data.home_team_id),
    awayTeamId: data.away_team_id == null ? null : Number(data.away_team_id),
    homeTeamName: typeof data.home_team_name === "string" ? data.home_team_name : null,
    awayTeamName: typeof data.away_team_name === "string" ? data.away_team_name : null,
    finished: status.includes("finished") || status.includes("ended")
  };
}

export async function upsertTeamStats(rows: LiveTeamStats[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await sb().from("live_team_stats_cache").upsert(
    rows.map((row) => ({
      fixture_id: row.fixtureId,
      team_id: row.teamId,
      shots: row.shots,
      shots_on_target: row.shotsOnTarget,
      corners: row.corners,
      possession: row.possession,
      fouls: row.fouls,
      yellow_cards: row.yellowCards,
      red_cards: row.redCards,
      penalties: row.penalties,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "fixture_id,team_id" }
  );
  if (error) throw new Error(error.message);
}

export async function readTeamStats(fixtureId: number): Promise<LiveTeamStats[]> {
  const { data, error } = await sb().from("live_team_stats_cache").select("*").eq("fixture_id", fixtureId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    fixtureId,
    teamId: Number(row.team_id),
    shots: Number(row.shots ?? 0),
    shotsOnTarget: Number(row.shots_on_target ?? 0),
    corners: Number(row.corners ?? 0),
    possession: Number(row.possession ?? 0),
    fouls: Number(row.fouls ?? 0),
    yellowCards: Number(row.yellow_cards ?? 0),
    redCards: Number(row.red_cards ?? 0),
    penalties: Number(row.penalties ?? 0)
  }));
}

export async function upsertPlayerStats(rows: LivePlayerStats[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await sb().from("live_player_stats_cache").upsert(
    rows.map((row) => ({
      fixture_id: row.fixtureId,
      player_id: row.playerId,
      goals: row.goals,
      assists: row.assists,
      shots: row.shots,
      shots_on_target: row.shotsOnTarget,
      fouls: row.fouls,
      fouls_received: row.foulsReceived,
      rating: row.rating,
      saves: row.saves,
      cards: row.cards,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "fixture_id,player_id" }
  );
  if (error) throw new Error(error.message);
}

export async function readPlayerStats(fixtureId: number): Promise<LivePlayerStats[]> {
  const { data, error } = await sb().from("live_player_stats_cache").select("*").eq("fixture_id", fixtureId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    fixtureId,
    playerId: Number(row.player_id),
    goals: Number(row.goals ?? 0),
    assists: Number(row.assists ?? 0),
    shots: Number(row.shots ?? 0),
    shotsOnTarget: Number(row.shots_on_target ?? 0),
    fouls: Number(row.fouls ?? 0),
    foulsReceived: Number(row.fouls_received ?? 0),
    rating: row.rating == null ? null : Number(row.rating),
    saves: Number(row.saves ?? 0),
    cards: Number(row.cards ?? 0)
  }));
}

export async function isTrackedLiveFixture(fixtureId: number): Promise<boolean> {
  const { data, error } = await sb()
    .from("active_live_matches")
    .select("fixture_id")
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function touchViewer(userId: string, fixtureId: number): Promise<void> {
  const { error } = await sb().from("live_hub_viewers").upsert(
    { user_id: userId, fixture_id: fixtureId, last_seen: new Date().toISOString() },
    { onConflict: "user_id,fixture_id" }
  );
  if (error) throw new Error(error.message);
}

export async function recountAndSyncActiveMatch(fixtureId: number): Promise<void> {
  const since = new Date(Date.now() - VIEWER_TTL_MS).toISOString();
  const client = sb();
  const [{ count: viewers }, alerts] = await Promise.all([
    client
      .from("live_hub_viewers")
      .select("user_id", { count: "exact", head: true })
      .eq("fixture_id", fixtureId)
      .gte("last_seen", since),
    listActiveAlerts(fixtureId)
  ]);
  const hasTeam = alerts.some((alert) => alert.alertType === "team");
  const hasPlayer = alerts.some((alert) => alert.alertType === "player");
  const viewerCount = viewers ?? 0;
  if (!hasTeam && !hasPlayer && viewerCount <= 0) {
    await deleteFixtureLiveData(fixtureId);
    return;
  }
  const { error } = await client.from("active_live_matches").upsert(
    {
      fixture_id: fixtureId,
      has_team_alert: hasTeam,
      has_player_alert: hasPlayer,
      active_viewers: viewerCount,
      priority: alerts.length >= 3 ? 3 : hasTeam || hasPlayer ? 2 : 1,
      last_update: new Date().toISOString()
    },
    { onConflict: "fixture_id" }
  );
  if (error) throw new Error(error.message);
}

export async function markMatchFetched(
  fixtureId: number,
  kind: "details" | "team" | "player"
): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    kind === "details"
      ? { last_details_at: now, last_update: now }
      : kind === "team"
        ? { last_team_stats_at: now, last_update: now }
        : { last_player_stats_at: now, last_update: now };
  await sb().from("active_live_matches").update(patch).eq("fixture_id", fixtureId);
}

export async function deleteFixtureLiveData(fixtureId: number): Promise<void> {
  const client = sb();
  await Promise.all([
    client.from("match_alerts").delete().eq("fixture_id", fixtureId),
    client.from("live_match_cache").delete().eq("fixture_id", fixtureId),
    client.from("live_team_stats_cache").delete().eq("fixture_id", fixtureId),
    client.from("live_player_stats_cache").delete().eq("fixture_id", fixtureId),
    client.from("live_hub_viewers").delete().eq("fixture_id", fixtureId),
    client.from("active_live_matches").delete().eq("fixture_id", fixtureId)
  ]);
}

export async function pruneStaleViewers(): Promise<void> {
  const cutoff = new Date(Date.now() - VIEWER_TTL_MS).toISOString();
  await sb().from("live_hub_viewers").delete().lt("last_seen", cutoff);
}
