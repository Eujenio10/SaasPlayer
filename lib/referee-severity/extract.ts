import type { RefereeIdentity } from "@/lib/referee-severity/types";

function readName(row: { name?: unknown; shortName?: unknown } | null | undefined): string {
  if (!row) return "";
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  if (typeof row.shortName === "string" && row.shortName.trim()) return row.shortName.trim();
  return "";
}

function readId(value: unknown): string | null {
  if (value == null) return null;
  const id = String(value).trim();
  return id || null;
}

/** Identità arbitro designato dal payload FootAPI `/api/match/{id}`. */
export function extractRefereeIdentityFromFootApiPayload(payload: unknown): RefereeIdentity | null {
  const root = payload as Record<string, unknown>;
  const event = (root?.event ?? root) as Record<string, unknown> | undefined;
  if (!event) return null;

  const direct = event.referee as { id?: number | string; name?: string; shortName?: string } | undefined;
  let id = readId(direct?.id);
  let name = readName(direct);

  const officials = event.officials;
  if (Array.isArray(officials)) {
    for (const official of officials) {
      const row = official as { id?: number | string; type?: string; name?: string; shortName?: string };
      const type = String(row.type ?? "").toLowerCase();
      if (!type.includes("referee")) continue;
      id = id ?? readId(row.id);
      name = name || readName(row);
      if (id && name) break;
    }
    if (!id) {
      const first = officials[0] as { id?: number | string; name?: string; shortName?: string } | undefined;
      id = readId(first?.id);
      name = name || readName(first);
    }
  }

  if (!id) return null;
  return { id, name };
}

export function extractSeasonIdFromFootApiPayload(payload: unknown): string | null {
  const root = payload as Record<string, unknown>;
  const event = (root?.event ?? root) as Record<string, unknown> | undefined;
  const season = event?.season as { id?: number | string } | undefined;
  return readId(season?.id);
}

export function extractTournamentIdFromFootApiPayload(payload: unknown): string | null {
  const root = payload as Record<string, unknown>;
  const event = (root?.event ?? root) as Record<string, unknown> | undefined;
  const tournament = event?.tournament as { uniqueTournament?: { id?: number | string }; id?: number | string } | undefined;
  return readId(tournament?.uniqueTournament?.id) ?? readId(tournament?.id) ?? readId(
    (event?.uniqueTournament as { id?: number | string } | undefined)?.id
  );
}
