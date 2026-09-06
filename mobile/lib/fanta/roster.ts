import * as SecureStore from "expo-secure-store";
import type { FantaRoleGroup } from "../../../lib/fanta/types";

const STORAGE_KEY = "pitchbrain.fantaRoster.v1";

export interface FantaRosterPlayer {
  playerId: string;
  playerName: string;
  teamName: string;
  roleGroup: FantaRoleGroup;
}

export type FantaRoster = Record<FantaRoleGroup, FantaRosterPlayer[]>;

export function emptyFantaRoster(): FantaRoster {
  return { goalkeeper: [], defender: [], midfielder: [], forward: [] };
}

export async function loadFantaRoster(): Promise<FantaRoster> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return emptyFantaRoster();
    const parsed = JSON.parse(raw) as Partial<FantaRoster>;
    const base = emptyFantaRoster();
    (Object.keys(base) as FantaRoleGroup[]).forEach((role) => {
      if (Array.isArray(parsed[role])) base[role] = parsed[role] as FantaRosterPlayer[];
    });
    return base;
  } catch {
    return emptyFantaRoster();
  }
}

export async function saveFantaRoster(roster: FantaRoster): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(roster));
}
