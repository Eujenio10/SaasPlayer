/**
 * Conta i cartellini dagli eventi FootAPI (incidents / events).
 * Yellow Card → giallo; Red Card e second yellow → rosso.
 */
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
    const type = String(row.type ?? row.incidentType ?? "").toLowerCase();
    const detail = String(row.detail ?? row.incidentClass ?? row.class ?? "").toLowerCase();
    const isCard = type.includes("card") || detail.includes("card") || detail.includes("yellow") || detail.includes("red");
    if (!isCard) continue;

    if (detail.includes("second") || detail.includes("yellowred") || detail.includes("yellow-red")) {
      red += 1;
      continue;
    }
    if (detail.includes("red")) {
      red += 1;
      continue;
    }
    if (detail.includes("yellow")) {
      yellow += 1;
    }
  }

  return { yellow, red };
}
