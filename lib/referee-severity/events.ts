/**
 * Conta i cartellini dagli eventi FootAPI (incidents).
 * Giallo → yellow; rosso e doppio giallo → red.
 * Non usa substring "red" su campi liberi (evita falsi positivi).
 */

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCardIncident(row: Record<string, unknown>): boolean {
  const type = text(row.type ?? row.incidentType);
  const incidentClass = text(row.incidentClass ?? row.class);
  return type === "card" || type.includes("card") || incidentClass === "yellow" || incidentClass === "red" || incidentClass === "yellowred";
}

function cardKind(row: Record<string, unknown>): "yellow" | "red" | null {
  const incidentClass = text(row.incidentClass ?? row.class);
  const detail = text(row.detail);
  const token = incidentClass || detail;
  if (!token) return null;
  if (token.includes("second") || token.includes("yellowred") || token.includes("yellow-red") || token === "yellowred") {
    return "red";
  }
  if (token === "red" || token.startsWith("red ") || token.endsWith(" red") || token === "redcard") {
    return "red";
  }
  if (token === "yellow" || token.startsWith("yellow") || token.includes("yellow card")) {
    return "yellow";
  }
  return null;
}

export function countCardsFromMatchEvents(payload: unknown): { yellow: number; red: number } {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const nestedEvent = (root.event && typeof root.event === "object" ? root.event : null) as
    | Record<string, unknown>
    | null;

  const pools: unknown[] = [];
  for (const key of ["incidents", "events", "eventIncidents"] as const) {
    const direct = root[key];
    if (Array.isArray(direct)) pools.push(...direct);
    const nested = nestedEvent?.[key];
    if (Array.isArray(nested)) pools.push(...nested);
  }

  let yellow = 0;
  let red = 0;
  for (const item of pools) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (!isCardIncident(row)) continue;
    const kind = cardKind(row);
    if (kind === "red") red += 1;
    else if (kind === "yellow") yellow += 1;
  }

  return { yellow, red };
}
