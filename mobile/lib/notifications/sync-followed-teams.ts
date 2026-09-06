import { MAX_FAVORITE_TEAMS, type FavoriteTeam } from "@/lib/favorite-team/types";
import { fetchFollowedTeams, putFollowedTeams } from "@/lib/notifications/api";

export function mergeFavoriteTeams(local: FavoriteTeam[], remote: FavoriteTeam[]): FavoriteTeam[] {
  const map = new Map<number, FavoriteTeam>();
  for (const team of remote) map.set(team.teamId, team);
  for (const team of local) map.set(team.teamId, team);
  return [...map.values()].slice(0, MAX_FAVORITE_TEAMS);
}

export async function syncFavoriteTeamsWithAccount(local: FavoriteTeam[]): Promise<FavoriteTeam[]> {
  const remote = await fetchFollowedTeams();
  const merged = mergeFavoriteTeams(local, remote.teams);
  await putFollowedTeams(merged);
  return merged;
}
