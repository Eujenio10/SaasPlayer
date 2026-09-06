import { z } from "zod";
import { fantaCompetitionId } from "@/lib/fanta/competition";
import {
  buildFantaDuel,
  buildFantaMatchupDetail,
  buildFantaMatchups,
  buildFantaRanking,
  buildFantaScout,
  buildFantaTrends,
  loadFantaCatalog,
  searchFantaCatalog
} from "@/lib/fanta/service";
import type { FantaRoleGroup, FantaTrendCategory } from "@/lib/fanta/types";

const localeSchema = z.enum(["it", "en"]).optional();
const roleSchema = z.enum(["all", "goalkeeper", "defender", "midfielder", "forward"]).optional();
const categorySchema = z.enum(["rising", "falling", "best5", "best10"]);

function parseLocale(searchParams: URLSearchParams): "it" | "en" {
  return searchParams.get("locale") === "en" ? "en" : "it";
}

function parseCompetition(): string {
  return fantaCompetitionId();
}

export async function handleFantaSearch(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const query = params.searchParams.get("q") ?? params.searchParams.get("query") ?? "";
  const locale = parseLocale(params.searchParams);
  const results = await searchFantaCatalog({
    organizationId: params.organizationId,
    competitionId,
    query,
    locale
  });
  return { competitionId, results };
}

export async function handleFantaScout(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const playerId = params.searchParams.get("playerId")?.trim() ?? "";
  if (!playerId) return { error: "missing_player" as const };
  const locale = parseLocale(params.searchParams);
  const player = await buildFantaScout({
    organizationId: params.organizationId,
    competitionId,
    playerId,
    locale
  });
  if (!player) return { error: "not_found" as const };
  return { competitionId, player };
}

export async function handleFantaRanking(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const role = (params.searchParams.get("role") ?? "all") as FantaRoleGroup | "all";
  const parsedRole = roleSchema.safeParse(role);
  const locale = parseLocale(params.searchParams);
  const payload = await buildFantaRanking({
    organizationId: params.organizationId,
    competitionId,
    role: parsedRole.success ? parsedRole.data : "all",
    locale
  });
  return { competitionId, ...payload };
}

export async function handleFantaTrends(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const parsed = categorySchema.safeParse(params.searchParams.get("category") ?? "rising");
  const locale = parseLocale(params.searchParams);
  const payload = await buildFantaTrends({
    organizationId: params.organizationId,
    competitionId,
    category: (parsed.success ? parsed.data : "rising") as FantaTrendCategory,
    locale
  });
  return { competitionId, category: parsed.success ? parsed.data : "rising", ...payload };
}

export async function handleFantaMatchups(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const locale = parseLocale(params.searchParams);
  const payload = await buildFantaMatchups({
    organizationId: params.organizationId,
    competitionId,
    locale
  });
  return { competitionId, ...payload };
}

export async function handleFantaMatchupDetail(params: {
  organizationId: string;
  searchParams: URLSearchParams;
  matchupId: string;
}) {
  const competitionId = parseCompetition();
  const locale = parseLocale(params.searchParams);
  const matchup = await buildFantaMatchupDetail({
    organizationId: params.organizationId,
    competitionId,
    matchupId: params.matchupId,
    locale
  });
  if (!matchup) return { error: "not_found" as const };
  return { competitionId, matchup };
}

const duelBodySchema = z.object({
  competitionId: z.string().min(1).optional(),
  locale: localeSchema,
  playerAId: z.string().min(1).optional(),
  playerBId: z.string().min(1).optional(),
  playerIdA: z.string().min(1).optional(),
  playerIdB: z.string().min(1).optional()
});

function readDuelPlayerIds(input: {
  playerAId?: string;
  playerBId?: string;
  playerIdA?: string;
  playerIdB?: string;
}): { playerAId: string; playerBId: string } | null {
  const playerAId = (input.playerAId ?? input.playerIdA ?? "").trim();
  const playerBId = (input.playerBId ?? input.playerIdB ?? "").trim();
  if (!playerAId || !playerBId) return null;
  return { playerAId, playerBId };
}

export async function handleFantaDuel(params: {
  organizationId: string;
  searchParams?: URLSearchParams;
  body?: unknown;
}) {
  const fromQuery = params.searchParams
    ? {
        competitionId: params.searchParams.get("competitionId") ?? undefined,
        locale: params.searchParams.get("locale") === "en" ? ("en" as const) : ("it" as const),
        playerAId: params.searchParams.get("playerAId") ?? params.searchParams.get("playerIdA") ?? undefined,
        playerBId: params.searchParams.get("playerBId") ?? params.searchParams.get("playerIdB") ?? undefined
      }
    : null;
  const parsedBody = params.body !== undefined ? duelBodySchema.safeParse(params.body) : null;
  if (parsedBody && !parsedBody.success) {
    return { error: "invalid_body" as const, details: parsedBody.error.flatten() };
  }
  const merged = {
    competitionId: parsedBody?.data.competitionId ?? fromQuery?.competitionId,
    locale: parsedBody?.data.locale ?? fromQuery?.locale ?? "it",
    playerAId: parsedBody?.data.playerAId ?? parsedBody?.data.playerIdA ?? fromQuery?.playerAId,
    playerBId: parsedBody?.data.playerBId ?? parsedBody?.data.playerIdB ?? fromQuery?.playerBId
  };
  const ids = readDuelPlayerIds(merged);
  if (!ids) {
    return {
      error: "missing_players" as const,
      message: "Seleziona due giocatori per effettuare il confronto."
    };
  }
  const competitionId = fantaCompetitionId();
  const payload = await buildFantaDuel({
    organizationId: params.organizationId,
    competitionId,
    playerAId: ids.playerAId,
    playerBId: ids.playerBId,
    locale: merged.locale ?? "it"
  });
  if (!payload.ok) {
    return { error: payload.error, message: payload.message };
  }
  return { competitionId, ...payload.duel, updatedAt: payload.updatedAt };
}

export async function handleFantaLineup(params: {
  organizationId: string;
  body: unknown;
}) {
  return handleFantaDuel({ organizationId: params.organizationId, body: params.body });
}

export async function handleFantaMeta(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const competitionId = parseCompetition();
  const locale = parseLocale(params.searchParams);
  const catalog = await loadFantaCatalog({
    organizationId: params.organizationId,
    competitionId,
    locale
  });
  return {
    competitionId,
    rounds: catalog.rounds,
    playerCount: catalog.players.length,
    matchupCount: catalog.markings.length,
    updatedAt: catalog.updatedAt
  };
}
