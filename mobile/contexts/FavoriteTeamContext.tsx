import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadFavoriteTeamsState, saveFavoriteTeamsState } from "@/lib/favorite-team/storage";
import { MAX_FAVORITE_TEAMS, type FavoriteTeam } from "@/lib/favorite-team/types";
import { useAuth } from "@/contexts/AuthContext";
import { putFollowedTeams } from "@/lib/notifications/api";
import { syncFavoriteTeamsWithAccount } from "@/lib/notifications/sync-followed-teams";

interface FavoriteTeamContextValue {
  favoriteTeams: FavoriteTeam[];
  activeTeam: FavoriteTeam | null;
  onboardingCompleted: boolean;
  ready: boolean;
  isFavorite: (teamId: number) => boolean;
  addFavoriteTeam: (team: FavoriteTeam) => Promise<boolean>;
  removeFavoriteTeam: (teamId: number) => Promise<void>;
  setActiveTeamId: (teamId: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const FavoriteTeamContext = createContext<FavoriteTeamContextValue | null>(null);

export function FavoriteTeamProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [teams, setTeams] = useState<FavoriteTeam[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<number | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [ready, setReady] = useState(false);
  const syncedUserRef = useRef<string | null>(null);
  const teamsRef = useRef<FavoriteTeam[]>([]);
  teamsRef.current = teams;

  useEffect(() => {
    let cancelled = false;
    void loadFavoriteTeamsState()
      .then((stored) => {
        if (cancelled) return;
        setTeams(stored.teams);
        setActiveTeamIdState(stored.activeTeamId);
        setOnboardingCompleted(stored.onboardingCompleted);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const userId = session?.user.id ?? null;
    if (!userId) {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === userId) return;
    syncedUserRef.current = userId;
    void syncFavoriteTeamsWithAccount(teamsRef.current)
      .then((merged) => {
        setTeams(merged);
        setActiveTeamIdState((current) => {
          const nextActive = merged.some((team) => team.teamId === current) ? current : (merged[0]?.teamId ?? null);
          void saveFavoriteTeamsState({
            teams: merged,
            activeTeamId: nextActive,
            onboardingCompleted
          });
          return nextActive;
        });
      })
      .catch(() => {
        syncedUserRef.current = null;
      });
  }, [onboardingCompleted, ready, session?.user.id]);

  const persist = useCallback(
    async (nextTeams: FavoriteTeam[], nextActive: number | null, nextOnboarding: boolean) => {
      await saveFavoriteTeamsState({
        teams: nextTeams,
        activeTeamId: nextActive,
        onboardingCompleted: nextOnboarding
      }).catch(() => undefined);
      if (session?.user.id) {
        await putFollowedTeams(nextTeams).catch(() => undefined);
      }
    },
    [session?.user.id]
  );

  const isFavorite = useCallback(
    (teamId: number) => teams.some((team) => team.teamId === teamId),
    [teams]
  );

  const addFavoriteTeam = useCallback(
    async (team: FavoriteTeam) => {
      const existing = teams.find((item) => item.teamId === team.teamId);
      if (existing) {
        const nextTeams = teams.map((item) => (item.teamId === team.teamId ? team : item));
        const nextActive = activeTeamId ?? team.teamId;
        setTeams(nextTeams);
        setActiveTeamIdState(nextActive);
        await persist(nextTeams, nextActive, onboardingCompleted);
        return true;
      }
      if (teams.length >= MAX_FAVORITE_TEAMS) return false;
      const nextTeams = [...teams, team];
      setTeams(nextTeams);
      setActiveTeamIdState(team.teamId);
      await persist(nextTeams, team.teamId, onboardingCompleted);
      return true;
    },
    [activeTeamId, onboardingCompleted, persist, teams]
  );

  const removeFavoriteTeam = useCallback(
    async (teamId: number) => {
      const nextTeams = teams.filter((team) => team.teamId !== teamId);
      const nextActive = nextTeams.some((team) => team.teamId === activeTeamId)
        ? activeTeamId
        : (nextTeams[0]?.teamId ?? null);
      setTeams(nextTeams);
      setActiveTeamIdState(nextActive);
      await persist(nextTeams, nextActive, onboardingCompleted);
    },
    [activeTeamId, onboardingCompleted, persist, teams]
  );

  const setActiveTeamId = useCallback(
    async (teamId: number) => {
      if (!teams.some((team) => team.teamId === teamId)) return;
      setActiveTeamIdState(teamId);
      await persist(teams, teamId, onboardingCompleted);
    },
    [onboardingCompleted, persist, teams]
  );

  const completeOnboarding = useCallback(async () => {
    setOnboardingCompleted(true);
    await persist(teams, activeTeamId, true);
  }, [activeTeamId, persist, teams]);

  const activeTeam = teams.find((team) => team.teamId === activeTeamId) ?? teams[0] ?? null;

  const value = useMemo(
    () => ({
      favoriteTeams: teams,
      activeTeam,
      onboardingCompleted,
      ready,
      isFavorite,
      addFavoriteTeam,
      removeFavoriteTeam,
      setActiveTeamId,
      completeOnboarding
    }),
    [
      activeTeam,
      addFavoriteTeam,
      completeOnboarding,
      isFavorite,
      onboardingCompleted,
      ready,
      removeFavoriteTeam,
      setActiveTeamId,
      teams
    ]
  );

  return <FavoriteTeamContext.Provider value={value}>{children}</FavoriteTeamContext.Provider>;
}

export function useFavoriteTeam(): FavoriteTeamContextValue {
  const ctx = useContext(FavoriteTeamContext);
  if (!ctx) {
    throw new Error("useFavoriteTeam must be used within FavoriteTeamProvider");
  }
  return ctx;
}
